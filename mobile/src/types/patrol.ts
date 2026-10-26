export interface PatrolScanPayload {
  token: string;
  lat: number;
  lng: number;
  accuracy_m: number;
  device_time: string; // ISO string in UTC
  request_id: string; // UUID for idempotency
}

export interface PatrolScanResult {
  id: string;
  qr_id: string;
  user_id: string;
  branch_id: string;
  device_time: string;
  server_time: string;
  lat: number;
  lng: number;
  accuracy_m: number;
  is_anomaly: boolean;
  anomaly_reason?: string | null;
  checkpoint_name?: string;
  branch_name?: string;
}

export interface PatrolQrItem {
  id: string;
  branch_id: string;
  name: string;
  token: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
}
