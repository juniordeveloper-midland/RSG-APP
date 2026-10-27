import axios, {
  AxiosError,
  AxiosInstance,
  InternalAxiosRequestConfig,
} from 'axios';
import { authStorage } from '../services/storage';
import { API_URL, API_TIMEOUT_MS } from '../config';

/**
 * Normalised error thrown by every API call. Mirrors the shape the rest of the
 * app already consumes (status / code / isNetworkError) and adds `isTimeout`
 * so callers can distinguish "server unreachable / slow" from "rejected".
 */
export class ApiError extends Error {
  status: number;
  code: string;
  isNetworkError: boolean;
  isTimeout: boolean;
  details?: unknown;

  constructor(
    message: string,
    status = 0,
    code = 'UNKNOWN',
    isNetworkError = false,
    isTimeout = false,
    details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.isNetworkError = isNetworkError;
    this.isTimeout = isTimeout;
    this.details = details;
  }
}

/**
 * Single shared axios instance.
 *
 * `baseURL` comes from config (EXPO_PUBLIC_API_URL) and the request interceptor
 * applies an optional in-app server override on top of it, so the default host
 * is config-driven while power users can still retarget the backend at runtime.
 */
export const apiClient: AxiosInstance = axios.create({
  baseURL: API_URL,
  timeout: API_TIMEOUT_MS,
  headers: { 'Content-Type': 'application/json' },
});

// ---- Token-refresh plumbing ------------------------------------------------
let isRefreshing = false;
let refreshSubscribers: Array<(token: string | null) => void> = [];

function subscribeTokenRefresh(cb: (token: string | null) => void): void {
  refreshSubscribers.push(cb);
}

function notifyTokenRefresh(token: string | null): void {
  const subs = refreshSubscribers;
  refreshSubscribers = [];
  subs.forEach((cb) => cb(token));
}

// ---- Session-expiration hook (wired up by AuthContext) ---------------------
// When a refresh fails we can't reach React state from here, so AuthContext
// registers a callback that clears the in-memory session so the UI flips back
// to the Login screen.
let sessionExpiredHandler: (() => void) | null = null;

export function setSessionExpiredHandler(handler: (() => void) | null): void {
  sessionExpiredHandler = handler;
}

function triggerSessionExpired(): void {
  try {
    sessionExpiredHandler?.();
  } catch {
    // never let a handler error propagate into request flow
  }
}

// ---- Request interceptor: attach Bearer token + resolve active base URL ----
apiClient.interceptors.request.use(async (config) => {
  // Apply any in-app server override (set via Login/More screens). Falls back
  // to the config default (EXPO_PUBLIC_API_URL) when none is stored.
  try {
    const activeBase = await authStorage.getServerUrl();
    if (activeBase) {
      config.baseURL = activeBase;
    }
  } catch {
    // ignore – keep the config default
  }

  try {
    const token = await authStorage.getAccessToken();
    const headers = config.headers as Record<string, string>;
    if (token && !headers.Authorization) {
      headers.Authorization = `Bearer ${token}`;
    }
  } catch {
    // ignore – send unauthenticated
  }

  if (__DEV__) {
    const full = `${config.baseURL ?? ''}${config.url ?? ''}`;
    // eslint-disable-next-line no-console
    console.log(`[API] → ${config.method?.toUpperCase() ?? 'GET'} ${full}`);
  }

  return config;
});

// ---- Response interceptor: dev logging + 401 refresh-once-then-logout ------
apiClient.interceptors.response.use(
  (response) => {
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.log(`[API] ← ${response.status} ${response.config.url ?? ''}`);
    }
    return response;
  },
  async (error: AxiosError<any>) => {
    const config = error.config as
      | (InternalAxiosRequestConfig & { _retry?: boolean })
      | undefined;
    const status = error.response?.status;
    const url = config?.url ?? '';

    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.error(
        `[API] ✗ ${config?.method?.toUpperCase() ?? 'GET'} ${url} -> ${
          status ?? 'no-response'
        } (${error.code ?? 'n/a'}): ${error.message}`,
      );
    }

    // 401 on a protected route -> attempt a single refresh, then retry once.
    // Auth endpoints (/auth/login, /auth/refresh) never trigger refresh.
    const isAuthEndpoint =
      url.includes('/auth/login') || url.includes('/auth/refresh');

    if (status === 401 && config && !config._retry && !isAuthEndpoint) {
      config._retry = true;
      const newToken = await refreshAccessToken();
      if (newToken) {
        const headers = config.headers as Record<string, string>;
        headers.Authorization = `Bearer ${newToken}`;
        return apiClient.request(config);
      }
      // Refresh failed -> clear session and surface as auth-expired.
      await authStorage.clearAuth();
      notifyTokenRefresh(null);
      triggerSessionExpired();
      throw new ApiError(
        'Authentication expired. Please log in again.',
        401,
        'AUTH_EXPIRED',
      );
    }

    // Timeout (no response received within API_TIMEOUT_MS)
    if (
      error.code === 'ECONNABORTED' ||
      error.code === 'ETIMEDOUT' ||
      (status === undefined && /timeout/i.test(error.message ?? ''))
    ) {
      throw new ApiError(
        'Request timed out. The server did not respond in time.',
        0,
        'TIMEOUT',
        true,
        true,
      );
    }

    // No response at all -> network / unreachable server
    if (!error.response) {
      throw new ApiError(
        'Unable to reach the RSG server. Check your Wi-Fi and API URL.',
        0,
        'NETWORK_ERROR',
        true,
      );
    }

    // HTTP error with a body. Backend envelope: { error: { code, message } }
    const errBody = error.response.data?.error;
    const message = errBody?.message ?? `Server error (${status})`;
    const code = errBody?.code ?? `HTTP_${status}`;
    throw new ApiError(message, status ?? 0, code, false, false, errBody?.details);
  },
);

/**
 * Refresh the access token using the stored refresh token. Returns the new
 * access token on success, or null on failure (the caller then logs out).
 *
 * Uses a plain axios call (not `apiClient`) so the request/refresh interceptors
 * don't recurse, and so we hit the active base URL directly.
 */
async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = await authStorage.getRefreshToken();
  if (!refreshToken) return null;

  if (isRefreshing) {
    // Another refresh is in flight – wait for its result.
    return new Promise<string | null>((resolve) => {
      subscribeTokenRefresh(resolve);
    });
  }

  isRefreshing = true;
  try {
    const base = await authStorage.getServerUrl();
    const res = await axios.post(
      `${base}/auth/refresh`,
      { refreshToken },
      {
        timeout: API_TIMEOUT_MS,
        headers: { 'Content-Type': 'application/json' },
      },
    );

    const body = res.data?.data ?? res.data;
    const newAccessToken: string | undefined = body?.accessToken;
    const newRefreshToken: string | undefined = body?.refreshToken;
    if (!newAccessToken) return null;

    await authStorage.setAccessToken(newAccessToken);
    if (newRefreshToken) {
      await authStorage.setRefreshToken(newRefreshToken);
    }
    notifyTokenRefresh(newAccessToken);
    return newAccessToken;
  } catch {
    notifyTokenRefresh(null);
    return null;
  } finally {
    isRefreshing = false;
  }
}

// ---- Public request helpers -------------------------------------------------

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** Request body. Pass an object (serialised by axios) or an already-JSON string. */
  body?: unknown;
  headers?: Record<string, string>;
}

/**
 * Fetch-style wrapper backed by axios. Unwraps the backend `{ success, data }`
 * envelope so callers receive the inner `data` directly.
 */
export async function apiFetch<T>(
  endpoint: string,
  options: RequestOptions = {},
): Promise<T> {
  const method = (options.method ?? 'GET').toUpperCase() as
    | 'GET'
    | 'POST'
    | 'PUT'
    | 'PATCH'
    | 'DELETE';

  const res = await apiClient.request({
    method,
    url: endpoint,
    data: options.body,
    headers: options.headers,
  });

  const body = res.data as unknown;
  // Backend success envelope: { success: true, data: {...} }
  if (body && typeof body === 'object' && 'data' in (body as object)) {
    return (body as { data: T }).data;
  }
  return body as T;
}

/** Typed alias kept for clarity at call sites. */
export const apiRequest = apiFetch;

/**
 * Low-level reachability probe for a base URL. Performs an unauthenticated
 * GET <baseUrl>/health with a short timeout using a plain axios call (no
 * interceptors, no auth header). Resolves on any 2xx; rejects on timeout,
 * network error, or non-2xx – so callers can render a clear
 * "Server reachable" / "Cannot reach <URL>" result.
 */
export async function pingBaseUrl(baseUrl: string, timeoutMs = 5000): Promise<void> {
  const normalized = baseUrl.replace(/\/+$/, '');
  await axios.get(`${normalized}/health`, { timeout: timeoutMs });
}
