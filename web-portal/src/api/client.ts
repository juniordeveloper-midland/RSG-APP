/**
 * RSG API Client - centralized fetch wrapper with JWT auto-refresh.
 * ALL backend calls are routed through the /api prefix so Vite can proxy
 * them cleanly without colliding with frontend routes.
 */

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'manager' | 'employee';
  status: 'active' | 'suspended';
  branch_id?: string | null;
  managerial_access?: boolean;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}

export class ApiClientError extends Error {
  status?: number;
  code?: string;
  isNetworkError: boolean;

  constructor(
    message: string,
    status?: number,
    code?: string,
    isNetworkError: boolean = false
  ) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.code = code;
    this.isNetworkError = isNetworkError;
    Object.setPrototypeOf(this, ApiClientError.prototype);
  }
}

// ─── Token Storage ───────────────────────────────────────────────────────────
const ACCESS_TOKEN_KEY = 'rsg_access_token';
const REFRESH_TOKEN_KEY = 'rsg_refresh_token';
const USER_KEY = 'rsg_user';

export const getAccessToken = (): string | null =>
  localStorage.getItem(ACCESS_TOKEN_KEY);
export const getRefreshToken = (): string | null =>
  localStorage.getItem(REFRESH_TOKEN_KEY);
export const getStoredUser = (): User | null => {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};
export const setAuthSession = (auth: AuthResponse) => {
  localStorage.setItem(ACCESS_TOKEN_KEY, auth.accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, auth.refreshToken);
  localStorage.setItem(USER_KEY, JSON.stringify(auth.user));
};
export const clearAuthSession = () => {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
};

// ─── Refresh Token Queuing ────────────────────────────────────────────────────
let isRefreshing = false;
let refreshSubscribers: ((token: string) => void)[] = [];

const subscribeTokenRefresh = (cb: (token: string) => void) =>
  refreshSubscribers.push(cb);
const onRefreshed = (token: string) => {
  refreshSubscribers.forEach((cb) => cb(token));
  refreshSubscribers = [];
};

// ─── API Base URL ─────────────────────────────────────────────────────────────
// Always /api — Vite strips it before forwarding to the backend.
const API_BASE = '/api';

/**
 * Core fetch wrapper.
 * - Prepends /api to every relative path.
 * - Injects Bearer token from localStorage.
 * - On 401, attempts silent token refresh once, then queues concurrent requests.
 * - On refresh failure, clears session and dispatches rsg:unauthorized.
 */
export async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  // Build the full URL: always route through /api
  const fullUrl = endpoint.startsWith('http')
    ? endpoint
    : `${API_BASE}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  const makeHeaders = (token?: string | null): Headers => {
    const h = new Headers(options.headers || {});
    const t = token ?? getAccessToken();
    if (t && !h.has('Authorization')) {
      h.set('Authorization', `Bearer ${t}`);
    }
    if (!(options.body instanceof FormData) && !h.has('Content-Type')) {
      h.set('Content-Type', 'application/json');
    }
    return h;
  };

  // ── First attempt ──────────────────────────────────────────────────────────
  let response: Response;
  try {
    response = await fetch(fullUrl, { ...options, headers: makeHeaders() });
  } catch {
    throw new ApiClientError(
      'Unable to connect to the backend server. Please check your network connection or verify the server is running.',
      0,
      'NETWORK_ERROR',
      true
    );
  }

  // ── 401 → try silent token refresh ────────────────────────────────────────
  const isAuthEndpoint =
    endpoint.includes('/auth/login') || endpoint.includes('/auth/refresh');

  if (response.status === 401 && !isAuthEndpoint) {
    const refreshToken = getRefreshToken();

    if (!refreshToken) {
      clearAuthSession();
      window.dispatchEvent(new Event('rsg:unauthorized'));
      throw new ApiClientError(
        'Authentication expired. Please log in again.',
        401,
        'AUTH_EXPIRED',
        false
      );
    }

    if (!isRefreshing) {
      isRefreshing = true;
      try {
        const refreshRes = await fetch(`${API_BASE}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });
        if (!refreshRes.ok) throw new Error('refresh failed');

        const rd = await refreshRes.json();
        const newAccess: string = rd.data.accessToken;
        const newRefresh: string | undefined = rd.data.refreshToken;

        localStorage.setItem(ACCESS_TOKEN_KEY, newAccess);
        if (newRefresh) localStorage.setItem(REFRESH_TOKEN_KEY, newRefresh);

        isRefreshing = false;
        onRefreshed(newAccess);
      } catch {
        isRefreshing = false;
        refreshSubscribers = [];
        clearAuthSession();
        window.dispatchEvent(new Event('rsg:unauthorized'));
        throw new ApiClientError(
          'Session expired. Please log in again.',
          401,
          'SESSION_EXPIRED',
          false
        );
      }
    }

    // Wait for the in-flight refresh to finish
    const retryToken = await new Promise<string>((resolve) => {
      subscribeTokenRefresh((t) => resolve(t));
    });

    try {
      response = await fetch(fullUrl, {
        ...options,
        headers: makeHeaders(retryToken),
      });
    } catch {
      throw new ApiClientError(
        'Unable to connect to the backend server after token refresh.',
        0,
        'NETWORK_ERROR',
        true
      );
    }
  }

  // ── Error responses ───────────────────────────────────────────────────────
  if (!response.ok) {
    if ([502, 503, 504].includes(response.status)) {
      throw new ApiClientError(
        `Backend server unavailable (${response.status}). Please ensure the backend is running on port 4000.`,
        response.status,
        'SERVER_UNAVAILABLE',
        true
      );
    }

    let errorMsg = `Request failed (${response.status})`;
    let errorCode = `HTTP_${response.status}`;
    try {
      const errJson = await response.json();
      if (errJson.error?.message) {
        errorMsg = errJson.error.message;
        errorCode = errJson.error.code || errorCode;
      } else if (errJson.message) {
        errorMsg = errJson.message;
      }
    } catch {
      // non-JSON error body
    }
    throw new ApiClientError(errorMsg, response.status, errorCode, false);
  }

  // ── Binary downloads ──────────────────────────────────────────────────────
  const ct = response.headers.get('content-type') || '';
  if (
    ct.includes('application/vnd.openxmlformats') ||
    ct.includes('image/') ||
    ct.includes('application/octet-stream')
  ) {
    return (await response.blob()) as unknown as T;
  }

  // ── JSON response ─────────────────────────────────────────────────────────
  const json = await response.json();
  // Unwrap { success: true, data: ... } envelope if present
  return json.data !== undefined ? json.data : json;
}

// ─── API Surface ──────────────────────────────────────────────────────────────
export const api = {
  // ── Auth ──────────────────────────────────────────────────────────────────
  login: (data: { email: string; password: string }) =>
    apiFetch<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  logout: () => {
    const refreshToken = getRefreshToken();
    return apiFetch('/auth/logout', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    });
  },

  // ── Dashboard ─────────────────────────────────────────────────────────────
  getDashboardStats: () => apiFetch<any>('/management/dashboard'),

  // ── Branches ─────────────────────────────────────────────────────────────
  getBranches: (params?: {
    page?: number;
    limit?: number;
    search?: string;
    is_active?: boolean;
  }) => {
    const q = new URLSearchParams();
    if (params?.page) q.set('page', String(params.page));
    if (params?.limit) q.set('limit', String(params.limit));
    if (params?.search) q.set('search', params.search);
    if (params?.is_active !== undefined)
      q.set('is_active', String(params.is_active));
    return apiFetch<any>(`/branches?${q}`);
  },
  getBranch: (id: string) => apiFetch<any>(`/branches/${id}`),
  createBranch: (data: any) =>
    apiFetch<any>('/branches', { method: 'POST', body: JSON.stringify(data) }),
  updateBranch: (id: string, data: any) =>
    apiFetch<any>(`/branches/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  disableBranch: (id: string) =>
    apiFetch<any>(`/branches/${id}/disable`, { method: 'PATCH' }),
  enableBranch: (id: string) =>
    apiFetch<any>(`/branches/${id}/enable`, { method: 'PATCH' }),

  // ── Employees ────────────────────────────────────────────────────────────
  getEmployees: (params?: {
    page?: number;
    limit?: number;
    branch_id?: string;
    status?: string;
    search?: string;
  }) => {
    const q = new URLSearchParams();
    if (params?.page) q.set('page', String(params.page));
    if (params?.limit) q.set('limit', String(params.limit));
    if (params?.branch_id) q.set('branch_id', params.branch_id);
    if (params?.status) q.set('status', params.status);
    if (params?.search) q.set('search', params.search);
    return apiFetch<any>(`/employees?${q}`);
  },
  createEmployee: (data: any) =>
    apiFetch<any>('/employees', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateEmployee: (id: string, data: any) =>
    apiFetch<any>(`/employees/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  updateEmployeeStatus: (id: string, status: 'active' | 'suspended') =>
    apiFetch<any>(`/employees/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
  setManagerialAccess: (id: string, managerial_access: boolean) =>
    apiFetch<any>(`/employees/${id}/managerial-access`, {
      method: 'PATCH',
      body: JSON.stringify({ managerial_access }),
    }),

  // ── Shifts ───────────────────────────────────────────────────────────────
  getShifts: (params?: {
    branch_id?: string;
    is_active?: boolean;
    search?: string;
  }) => {
    const q = new URLSearchParams();
    if (params?.branch_id) q.set('branch_id', params.branch_id);
    if (params?.is_active !== undefined)
      q.set('is_active', String(params.is_active));
    if (params?.search) q.set('search', params.search);
    return apiFetch<any>(`/shifts?${q}`);
  },
  createShift: (data: any) =>
    apiFetch<any>('/shifts', { method: 'POST', body: JSON.stringify(data) }),
  updateShift: (id: string, data: any) =>
    apiFetch<any>(`/shifts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  disableShift: (id: string) =>
    apiFetch<any>(`/shifts/${id}/disable`, { method: 'PATCH' }),
  enableShift: (id: string) =>
    apiFetch<any>(`/shifts/${id}/enable`, { method: 'PATCH' }),
  assignShift: (shiftId: string, data: any) =>
    apiFetch<any>(`/shifts/${shiftId}/assign`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  downloadShiftTemplate: () => apiFetch<Blob>('/shifts/template'),
  importShiftsExcel: (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return apiFetch<any>('/shifts/import', { method: 'POST', body: fd });
  },

  // ── Attendance ────────────────────────────────────────────────────────────
  getAttendance: (params?: {
    page?: number;
    limit?: number;
    branch_id?: string;
    user_id?: string;
    start_date?: string;
    end_date?: string;
    status?: string;
  }) => {
    const q = new URLSearchParams();
    if (params?.page) q.set('page', String(params.page));
    if (params?.limit) q.set('limit', String(params.limit));
    if (params?.branch_id) q.set('branch_id', params.branch_id);
    if (params?.user_id) q.set('user_id', params.user_id);
    if (params?.start_date) q.set('start_date', params.start_date);
    if (params?.end_date) q.set('end_date', params.end_date);
    if (params?.status) q.set('status', params.status);
    return apiFetch<any>(`/attendance?${q}`);
  },
  getActiveAttendance: (branchId?: string) => {
    const q = branchId ? `?branch_id=${branchId}` : '';
    return apiFetch<any[]>(`/attendance/active${q}`);
  },
  createManualAttendance: (data: any) =>
    apiFetch<any>('/attendance/manual', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  forceCheckout: (id: string) =>
    apiFetch<any>(`/attendance/${id}/force-checkout`, { method: 'POST' }),
  deleteAttendance: (id: string) =>
    apiFetch<any>(`/attendance/${id}`, { method: 'DELETE' }),

  // ── Patrol ────────────────────────────────────────────────────────────────
  getPatrolQrs: (branchId?: string, isActive?: boolean) => {
    const q = new URLSearchParams();
    if (branchId) q.set('branch_id', branchId);
    if (isActive !== undefined) q.set('is_active', String(isActive));
    return apiFetch<any[]>(`/patrol/qrs?${q}`);
  },
  createPatrolQr: (data: any) =>
    apiFetch<any>('/patrol/qrs', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getPatrolQrImageBlob: (id: string) =>
    apiFetch<Blob>(`/patrol/qrs/${id}/image`),
  getPatrolLogs: (params?: {
    page?: number;
    limit?: number;
    branch_id?: string;
    qr_id?: string;
    user_id?: string;
    is_anomaly?: boolean;
    start_date?: string;
    end_date?: string;
  }) => {
    const q = new URLSearchParams();
    if (params?.page) q.set('page', String(params.page));
    if (params?.limit) q.set('limit', String(params.limit));
    if (params?.branch_id) q.set('branch_id', params.branch_id);
    if (params?.qr_id) q.set('qr_id', params.qr_id);
    if (params?.user_id) q.set('user_id', params.user_id);
    if (params?.is_anomaly !== undefined)
      q.set('is_anomaly', String(params.is_anomaly));
    if (params?.start_date) q.set('start_date', params.start_date);
    if (params?.end_date) q.set('end_date', params.end_date);
    return apiFetch<any>(`/patrol/logs?${q}`);
  },
  exportPatrolLogsExcel: (params?: {
    branch_id?: string;
    is_anomaly?: boolean;
  }) => {
    const q = new URLSearchParams();
    if (params?.branch_id) q.set('branch_id', params.branch_id);
    if (params?.is_anomaly !== undefined)
      q.set('is_anomaly', String(params.is_anomaly));
    return apiFetch<Blob>(`/patrol/logs/export?${q}`);
  },

  // ── Alerts ────────────────────────────────────────────────────────────────
  getAlerts: (params?: { branch_id?: string; status?: string }) => {
    const q = new URLSearchParams();
    if (params?.branch_id) q.set('branch_id', params.branch_id);
    if (params?.status) q.set('status', params.status);
    return apiFetch<any[]>(`/management/alerts?${q}`);
  },
  updateAlertStatus: (id: string, status: 'acknowledged' | 'resolved') =>
    apiFetch<any>(`/management/alerts/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
};
