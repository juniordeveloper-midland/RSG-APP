import { authStorage } from './storage';
import { offlineDb } from './database';
import { AuthResponse, LoginCredentials, User } from '../types/auth';
import { AttendanceRecord, CheckInPayload, CheckOutPayload } from '../types/attendance';
import { PatrolScanPayload, PatrolScanResult } from '../types/patrol';
import { RotaItem } from '../types/shift';
import { apiFetch, ApiError } from '../api/client';

// Re-export so existing imports (`import { apiFetch, ApiError } from './api'`)
// – e.g. the offline queue – keep working against the single axios client.
export { apiFetch, ApiError };

export interface OfflineOptimisticResponse<T> {
  data: T;
  isOffline: boolean;
  status: 'pending';
  requestId: string;
}

export const api = {
  // ---- Auth ---------------------------------------------------------------

  /**
   * POST /auth/login
   * Backend returns: { success: true, data: { accessToken, refreshToken, user } }
   * `apiFetch` unwraps `data`, so we map accessToken / refreshToken / user
   * directly and persist them to expo-secure-store.
   */
  login: async (credentials: LoginCredentials): Promise<AuthResponse> => {
    const res = await apiFetch<AuthResponse>('/auth/login', {
      method: 'POST',
      body: { ...credentials, client_type: 'mobile' },
    });

    if (res.user.role === 'admin') {
      await authStorage.clearAuth();
      throw new ApiError('Administrators cannot log in to the mobile app.', 403, 'FORBIDDEN');
    }

    // Explicit field mapping (no snake_case/ camelCase mismatch).
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
          body: { refreshToken },
        });
      }
    } catch {
      // Ignore network errors on logout – we clear locally regardless.
    } finally {
      await authStorage.clearAuth();
    }
  },

  /**
   * GET /me
   * Backend returns: { success: true, data: { user: {...} } }
   * So after `apiFetch` unwraps `data` we still have `{ user }` and must pull
   * the nested user object out before exposing it as a `User`.
   */
  getCurrentUser: async (): Promise<User> => {
    const res = await apiFetch<{ user: User }>('/me');
    return res.user;
  },

  // ---- Rota ---------------------------------------------------------------

  getMyRota: async (): Promise<RotaItem[]> => {
    try {
      // GET /me/rota -> { success, data: { rota: [...] } }. After apiFetch
      // unwraps `data` we still have { rota: [...] }, so pull the array out.
      const res = await apiFetch<{ rota: any[] }>('/me/rota');
      const rawRota = res?.rota ?? [];
      const rota: RotaItem[] = rawRota.map((r: any) => {
        const startStr = r.start_date ? String(r.start_date).slice(0, 10) : '';
        const endStr = r.end_date ? String(r.end_date).slice(0, 10) : null;
        return {
          id: r.id || r.assignment_id,
          assignment_id: r.assignment_id || r.id,
          shift_id: r.shift_id || r.shift?.id,
          user_id: r.user_id,
          start_date: startStr,
          end_date: endStr,
          excluded_dates: r.excluded_dates,
          days_of_week: r.days_of_week,
          shift: {
            ...r.shift,
            branch: r.shift?.branch
              ? {
                  ...r.shift.branch,
                  lat: Number(r.shift.branch.lat),
                  lng: Number(r.shift.branch.lng),
                  radius_m: Number(r.shift.branch.radius_m) || 150,
                  is_active: r.shift.branch.is_active ?? true,
                }
              : undefined,
          },
        };
      });
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

  // ---- Attendance (with offline queue fallbacks) ---------------------------

  getCurrentAttendance: async (): Promise<any | null> => {
    try {
      const res = await apiFetch<any>('/attendance/current');
      if (res && (res.status === 'checked_in' || res.status === 'in_progress')) {
        await offlineDb.setCache('active_attendance', res);
        return res;
      }
      await offlineDb.setCache('active_attendance', null as any);
      return null;
    } catch (err: any) {
      if (err.isNetworkError) {
        const cached = await offlineDb.getCache<any>('active_attendance');
        if (cached && (cached.status === 'in_progress' || cached.status === 'checked_in')) {
          return cached;
        }
      }
      throw err;
    }
  },

  checkIn: async (
    payload: CheckInPayload,
  ): Promise<AttendanceRecord | OfflineOptimisticResponse<Partial<AttendanceRecord>>> => {
    try {
      const result = await apiFetch<AttendanceRecord>('/attendance/check-in', {
        method: 'POST',
        body: payload,
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
          payload,
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
    payload: CheckOutPayload,
  ): Promise<AttendanceRecord | OfflineOptimisticResponse<Partial<AttendanceRecord>>> => {
    try {
      const result = await apiFetch<AttendanceRecord>('/attendance/check-out', {
        method: 'POST',
        body: payload,
      });
      await offlineDb.setCache('active_attendance', null as any);
      return result;
    } catch (err: any) {
      if (err.isNetworkError) {
        await offlineDb.enqueue(
          payload.request_id,
          'attendance_checkout',
          '/attendance/check-out',
          payload,
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

  // ---- Patrol scan (with offline queue fallbacks) --------------------------

  scanPatrolQr: async (
    payload: PatrolScanPayload,
  ): Promise<PatrolScanResult | OfflineOptimisticResponse<Partial<PatrolScanResult>>> => {
    try {
      const result = await apiFetch<PatrolScanResult>('/patrol/scan', {
        method: 'POST',
        body: payload,
      });
      return result;
    } catch (err: any) {
      if (err.isNetworkError) {
        await offlineDb.enqueue(
          payload.request_id,
          'patrol_scan',
          '/patrol/scan',
          payload,
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
