export type QueueActionType =
  | 'attendance_checkin'
  | 'attendance_checkout'
  | 'patrol_scan';

export type QueueItemStatus = 'pending' | 'synced' | 'failed';

export interface OfflineQueueItem {
  id: number;
  request_id: string;
  action_type: QueueActionType;
  endpoint: string;
  payload: string; // JSON string
  created_at: string; // UTC ISO string
  status: QueueItemStatus;
  retry_count: number;
  last_error?: string | null;
  last_attempt?: string | null;
}
