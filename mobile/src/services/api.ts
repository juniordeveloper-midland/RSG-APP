import { authStorage } from './storage';
import { offlineDb } from './database';
import { QueueActionType } from '../types/offline';
import { AuthResponse, LoginCredentials, User } from '../types/auth';
import { AttendanceRecord, CheckInPayload, CheckOutPayload } from '../types/attendance';
import { PatrolScanPayload, PatrolScanResult } from '../types/patrol';
import { RotaItem } from '../types/shift';

export class ApiError extends Error {
  status?: number;
  code?: string;
  isNetworkError: boolean;

  constructor(message: string, status?: number, code?: string, isNetworkError: boolean = false) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.isNetworkError = isNetworkError;
  }
}

export interface OfflineOptimisticResponse<T> {
  data: T;
  isOffline: boolean;
  status: 'pending';
  requestId: string;
}

// Queue for pending requests while refreshing token
let isRefreshing = false;
let refreshSubscribers: ((token: string) => void)[] = [];

const subscribeTokenRefresh = (cb: (token: string) => void) => {
  refreshSubscribers.push(cb);
};

const onRefreshed = (token: string) => {
  refreshSubscribers.forEach((cb) => cb(token));
  refreshSubscribers = [];
};

/**
 * Base HTTP fetch wrapper with JWT refresh and network error detection.
 */
export async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {},
  isRetry: boolean = false
): Promise<T> {
  const baseUrl = await authStorage.getServerUrl();
  const url = endpoint.startsWith('http') ? endpoint : `${baseUrl}${endpoint}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  const token = await authStorage.getAccessToken();
  if (token && !headers['Authorization']) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(url, { ...options, headers });
  } catch (err: any) {
    throw new ApiError(
      'Unable to connect to RSG Server. Please check your internet connection or server settings.',
      0,
      'NETWORK_ERROR',
      true
    );
  }

  // Token refresh logic on 401
  if (response.status === 401 && !endpoint.includes('/auth/login') && !endpoint.includes('/auth/refresh') && !isRetry) {
    const refreshToken = await authStorage.getRefreshToken();
    if (!refreshToken) {
      await authStorage.clearAuth();
      throw new ApiError('Authentication expired. Please log in again.', 401, 'AUTH_EXPIRED');
    }

    if (!isRefreshing) {
      isRefreshing = true;
      try {
        const refreshRes = await fetch(`${baseUrl}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });

        if (!refreshRes.ok) {
          throw new Error('Refresh rejected');
        }

        const refreshData = await refreshRes.json();
        const newAccessToken = refreshData.data.accessToken;
        const newRefreshToken = refreshData.data.refreshToken;

        await authStorage.setAccessToken(newAccessToken);
        if (newRefreshToken) {
          await authStorage.setRefreshToken(newRefreshToken);
        }

        isRefreshing = false;
        onRefreshed(newAccessToken);
      } catch {
        isRefreshing = false;
        refreshSubscribers = [];
        await authStorage.clearAuth();
        throw new ApiError('Session expired. Please log in again.', 401, 'SESSION_EXPIRED');
      }
    }

    const retryToken = await new Promise<string>((resolve) => {
      subscribeTokenRefresh((t) => resolve(t));
    });

    headers['Authorization'] = `Bearer ${retryToken}`;
    return apiFetch<T>(endpoint, { ...options, headers }, true);
  }

  if (!response.ok) {
    let errorMessage = `Server error (${response.status})`;
    let errorCode = `HTTP_${response.status}`;

    try {
      const errJson = await response.json();
      if (errJson.error?.message) {
        errorMessage = errJson.error.message;
        errorCode = errJson.error.code || errorCode;
      }
    } catch {
      // response wasn't JSON
    }

    throw new ApiError(errorMessage, response.status, errorCode, false);
  }

  const json = await response.json();
  return json.data !== undefined ? json.data : json;
}

export const api = {
  // Auth
  login: async (credentials: LoginCredentials): Promise<AuthResponse> => {
    const res = await apiFetch<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
    await authStorage.setAccessToken(res.accessToken);
    await authStorage.setRefreshToken(res.refreshToken);
    await authStorage.setUser(res.user);
    return res;
  },

  logout: async (): Promise<void> => {
    const refreshToken = await authStorage.getRefreshToken();
    try {
      if (refreshToken) {
        await apiFetch('/auth/logout', {
          method: 'POST',
          body: JSON.stringify({ refreshToken }),
        });
      }
    } catch {
      // Ignore network errors on logout
    } finally {
      await authStorage.clearAuth();
    }
  },

  getCurrentUser: () => apiFetch<User>('/me'),

  // Rota
  getMyRota: async (): Promise<RotaItem[]> => {
    try {
      const rota = await apiFetch<RotaItem[]>('/me/rota');
      await offlineDb.setCache('my_rota', rota);
      return rota;
    } catch (err: any) {
      if (err.isNetworkError) {
        const cached = await offlineDb.getCache<RotaItem[]>('my_rota');
        if (cached) return cached;
      }
      throw err;
    }
  },

  // Attendance (with offline queue fallbacks)
  checkIn: async (
    payload: CheckInPayload
  ): Promise<AttendanceRecord | OfflineOptimisticResponse<Partial<AttendanceRecord>>> => {
    try {
      const result = await apiFetch<AttendanceRecord>('/attendance/check-in', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      // Cache active shift
      await offlineDb.setCache('active_attendance', result);
      return result;
    } catch (err: any) {
      if (err.isNetworkError) {
        // Enqueue into offline SQLite database
        await offlineDb.enqueue(
          payload.request_id,
          'attendance_checkin',
          '/attendance/check-in',
          payload
        );

        const optimisticRecord: Partial<AttendanceRecord> = {
          shift_id: payload.shift_id,
          date: payload.device_time.split('T')[0],
          check_in_time: payload.device_time,
          check_in_lat: payload.lat,
          check_in_lng: payload.lng,
          check_in_accuracy: payload.accuracy_m,
          status: 'in_progress',
          check_type: payload.method === 'qr' ? 'qr' : 'gps',
          request_id: payload.request_id,
          device_time: payload.device_time,
          server_time: payload.device_time, // Flagged pending
        };

        await offlineDb.setCache('active_attendance', optimisticRecord);

        return {
          data: optimisticRecord,
          isOffline: true,
          status: 'pending',
          requestId: payload.request_id,
        };
      }
      throw err;
    }
  },

  checkOut: async (
    payload: CheckOutPayload
  ): Promise<AttendanceRecord | OfflineOptimisticResponse<Partial<AttendanceRecord>>> => {
    try {
      const result = await apiFetch<AttendanceRecord>('/attendance/check-out', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      await offlineDb.setCache('active_attendance', null as any);
      return result;
    } catch (err: any) {
      if (err.isNetworkError) {
        await offlineDb.enqueue(
          payload.request_id,
          'attendance_checkout',
          '/attendance/check-out',
          payload
        );

        const optimisticRecord: Partial<AttendanceRecord> = {
          shift_id: payload.shift_id,
          check_out_time: payload.device_time,
          check_out_lat: payload.lat,
          check_out_lng: payload.lng,
          check_out_accuracy: payload.accuracy_m,
          status: 'present',
          request_id: payload.request_id,
        };

        await offlineDb.setCache('active_attendance', null as any);

        return {
          data: optimisticRecord,
          isOffline: true,
          status: 'pending',
          requestId: payload.request_id,
        };
      }
      throw err;
    }
  },

  // Patrol scan (with offline queue fallbacks)
  scanPatrolQr: async (
    payload: PatrolScanPayload
  ): Promise<PatrolScanResult | OfflineOptimisticResponse<Partial<PatrolScanResult>>> => {
    try {
      const result = await apiFetch<PatrolScanResult>('/patrol/scan', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      return result;
    } catch (err: any) {
      if (err.isNetworkError) {
        await offlineDb.enqueue(
          payload.request_id,
          'patrol_scan',
          '/patrol/scan',
          payload
        );

        const optimisticScan: Partial<PatrolScanResult> = {
          device_time: payload.device_time,
          server_time: payload.device_time,
          lat: payload.lat,
          lng: payload.lng,
          accuracy_m: payload.accuracy_m,
          is_anomaly: false,
        };

        return {
          data: optimisticScan,
          isOffline: true,
          status: 'pending',
          requestId: payload.request_id,
        };
      }
      throw err;
    }
  },
};
