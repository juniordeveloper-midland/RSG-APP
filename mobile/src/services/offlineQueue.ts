import { offlineDb } from './database';
import { apiFetch, ApiError } from './api';
import { OfflineQueueItem } from '../types/offline';

export type SyncListener = (pendingCount: number, isSyncing: boolean) => void;

class OfflineQueueService {
  private isSyncing = false;
  private listeners: Set<SyncListener> = new Set();
  private timer: ReturnType<typeof setInterval> | null = null;

  subscribe(listener: SyncListener): () => void {
    this.listeners.add(listener);
    // Initial call
    this.notify();
    return () => this.listeners.delete(listener);
  }

  private async notify() {
    const pendingCount = await offlineDb.getPendingCount();
    this.listeners.forEach((l) => l(pendingCount, this.isSyncing));
  }

  /**
   * Start periodic background sync worker.
   */
  startPeriodicSync(intervalMs: number = 30000): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = setInterval(() => {
      this.syncPending();
    }, intervalMs);
  }

  stopPeriodicSync(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /**
   * Synchronize pending items in the offline queue with exponential backoff.
   */
  async syncPending(): Promise<{ syncedCount: number; failedCount: number }> {
    if (this.isSyncing) return { syncedCount: 0, failedCount: 0 };
    this.isSyncing = true;
    await this.notify();

    let syncedCount = 0;
    let failedCount = 0;

    try {
      const pendingItems = await offlineDb.getPending();

      for (const item of pendingItems) {
        // Exponential backoff check: if retried before, wait 2^retry_count * 5 seconds
        if (item.retry_count > 0 && item.last_attempt) {
          const lastAttemptTime = new Date(item.last_attempt).getTime();
          const waitTimeMs = Math.min(Math.pow(2, item.retry_count) * 5000, 300000); // Max 5 mins
          if (Date.now() - lastAttemptTime < waitTimeMs) {
            continue; // Skip until backoff window passes
          }
        }

        try {
          const payloadObj = JSON.parse(item.payload);

          await apiFetch(item.endpoint, {
            method: 'POST',
            body: JSON.stringify(payloadObj),
          });

          // Successfully processed
          await offlineDb.markSynced(item.request_id);
          syncedCount++;
        } catch (err: any) {
          failedCount++;
          if (err instanceof ApiError && err.isNetworkError) {
            // Still offline - keep as pending, increment retry
            await offlineDb.markFailed(item.request_id, 'Network connection unavailable');
            break; // Stop further attempts if device is offline
          } else {
            // Server error (e.g. 403 or 409)
            await offlineDb.markFailed(
              item.request_id,
              err.message || 'Server rejected synchronization'
            );
          }
        }
      }
    } finally {
      this.isSyncing = false;
      await this.notify();
    }

    return { syncedCount, failedCount };
  }

  async retryAll(): Promise<void> {
    await offlineDb.retryAllFailed();
    await this.syncPending();
  }

  async getPendingCount(): Promise<number> {
    return await offlineDb.getPendingCount();
  }

  async getAllItems(): Promise<OfflineQueueItem[]> {
    return await offlineDb.getAll();
  }
}

export const offlineQueue = new OfflineQueueService();
