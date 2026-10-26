export interface CheckInPayload {
  shift_id: string;
  lat: number;
  lng: number;
  accuracy_m: number;
  device_time: string; // ISO string in UTC
  method: 'gps' | 'qr' | 'manual';
  request_id: string; // UUID for idempotency
}

export interface CheckOutPayload {
  shift_id: string;
  lat: number;
  lng: number;
  accuracy_m: number;
  device_time: string; // ISO string in UTC
  method: 'gps' | 'qr' | 'manual';
  request_id: string; // UUID for idempotency
}

export interface AttendanceRecord {
  id: string;
  shift_id: string;
  user_id: string;
  branch_id: string;
  date: string;
  check_in_time: string;
  check_out_time?: string | null;
  check_in_lat: number;
  check_in_lng: number;
  check_in_accuracy: number;
  check_out_lat?: number | null;
  check_out_lng?: number | null;
  check_out_accuracy?: number | null;
  status: 'present' | 'late' | 'absent' | 'in_progress';
  check_type: 'gps' | 'qr';
  request_id: string;
  device_time: string;
  server_time: string;
  lunch_deducted_minutes?: number;
  overtime_hours?: number;
  system_generated?: boolean;
  shift?: {
    id: string;
    name: string;
    start_time: string;
    end_time: string;
  };
  branch?: {
    id: string;
    name: string;
    address: string;
  };
}
