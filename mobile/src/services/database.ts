import * as SQLite from 'expo-sqlite';
import { Platform } from 'react-native';
import { OfflineQueueItem, QueueActionType, QueueItemStatus } from '../types/offline';

const DB_NAME = 'rsg_offline.db';

let dbInstance: SQLite.SQLiteDatabase | null = null;

// In-memory fallback for web preview
const webFallbackQueue: OfflineQueueItem[] = [];
let webQueueCounter = 1;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase | null> {
  if (Platform.OS === 'web') return null;

  if (!dbInstance) {
    try {
      dbInstance = await SQLite.openDatabaseAsync(DB_NAME);
      await initDatabase(dbInstance);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('Could not initialize native SQLite, falling back to memory queue:', err);
      return null;
    }
  }
  return dbInstance;
}

async function initDatabase(db: SQLite.SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS offline_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      request_id TEXT UNIQUE NOT NULL,
      action_type TEXT NOT NULL,
      endpoint TEXT NOT NULL,
      payload TEXT NOT NULL,
      created_at TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      retry_count INTEGER NOT NULL DEFAULT 0,
      last_error TEXT,
      last_attempt TEXT
    );

    CREATE TABLE IF NOT EXISTS local_cache (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
}

export const offlineDb = {
  /**
   * Insert a new action into the offline queue.
   */
  enqueue: async (
    requestId: string,
    actionType: QueueActionType,
    endpoint: string,
    payload: object
  ): Promise<OfflineQueueItem> => {
    const createdAt = new Date().toISOString();
    const payloadStr = JSON.stringify(payload);

    const db = await getDatabase();
    if (!db) {
      const item: OfflineQueueItem = {
        id: webQueueCounter++,
        request_id: requestId,
        action_type: actionType,
        endpoint,
        payload: payloadStr,
        created_at: createdAt,
        status: 'pending',
        retry_count: 0,
        last_error: null,
        last_attempt: null,
      };
      webFallbackQueue.unshift(item);
      return item;
    }

    await db.runAsync(
      `INSERT OR REPLACE INTO offline_queue 
       (request_id, action_type, endpoint, payload, created_at, status, retry_count)
       VALUES (?, ?, ?, ?, ?, 'pending', 0);`,
      [requestId, actionType, endpoint, payloadStr, createdAt]
    );

    const row = await db.getFirstAsync<OfflineQueueItem>(
      `SELECT * FROM offline_queue WHERE request_id = ?`,
      [requestId]
    );

    return row || {
      id: Date.now(),
      request_id: requestId,
      action_type: actionType,
      endpoint,
      payload: payloadStr,
      created_at: createdAt,
      status: 'pending',
      retry_count: 0,
      last_error: null,
      last_attempt: null,
    };
  },

  /**
   * Get all pending items ordered by created_at.
   */
  getPending: async (): Promise<OfflineQueueItem[]> => {
    const db = await getDatabase();
    if (!db) {
      return webFallbackQueue.filter((item) => item.status === 'pending');
    }

    return await db.getAllAsync<OfflineQueueItem>(
      `SELECT * FROM offline_queue WHERE status = 'pending' ORDER BY created_at ASC`
    );
  },

  /**
   * Get all queue items (pending, synced, failed) for the queue viewer.
   */
  getAll: async (limit: number = 50): Promise<OfflineQueueItem[]> => {
    const db = await getDatabase();
    if (!db) {
      return webFallbackQueue.slice(0, limit);
    }

    return await db.getAllAsync<OfflineQueueItem>(
      `SELECT * FROM offline_queue ORDER BY created_at DESC LIMIT ?`,
      [limit]
    );
  },

  /**
   * Count total pending items.
   */
  getPendingCount: async (): Promise<number> => {
    const db = await getDatabase();
    if (!db) {
      return webFallbackQueue.filter((i) => i.status === 'pending').length;
    }

    const row = await db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) as count FROM offline_queue WHERE status = 'pending'`
    );
    return row?.count || 0;
  },

  /**
   * Mark an item as successfully synced with the server.
   */
  markSynced: async (requestId: string): Promise<void> => {
    const db = await getDatabase();
    if (!db) {
      const item = webFallbackQueue.find((i) => i.request_id === requestId);
      if (item) {
        item.status = 'synced';
        item.last_attempt = new Date().toISOString();
      }
      return;
    }

    await db.runAsync(
      `UPDATE offline_queue 
       SET status = 'synced', last_attempt = ? 
       WHERE request_id = ?`,
      [new Date().toISOString(), requestId]
    );
  },

  /**
   * Mark an item as failed with error details and increment retry counter.
   */
  markFailed: async (requestId: string, error: string): Promise<void> => {
    const db = await getDatabase();
    const now = new Date().toISOString();

    if (!db) {
      const item = webFallbackQueue.find((i) => i.request_id === requestId);
      if (item) {
        item.status = 'failed';
        item.retry_count += 1;
        item.last_error = error;
        item.last_attempt = now;
      }
      return;
    }

    await db.runAsync(
      `UPDATE offline_queue 
       SET status = 'failed', retry_count = retry_count + 1, last_error = ?, last_attempt = ? 
       WHERE request_id = ?`,
      [error, now, requestId]
    );
  },

  /**
   * Reset failed items back to pending for manual retry.
   */
  retryAllFailed: async (): Promise<void> => {
    const db = await getDatabase();
    if (!db) {
      webFallbackQueue.forEach((item) => {
        if (item.status === 'failed') item.status = 'pending';
      });
      return;
    }

    await db.runAsync(`UPDATE offline_queue SET status = 'pending' WHERE status = 'failed'`);
  },

  /**
   * Save a cache value (e.g. today's rota or active attendance)
   */
  setCache: async (key: string, data: object): Promise<void> => {
    const db = await getDatabase();
    const jsonStr = JSON.stringify(data);
    const now = new Date().toISOString();

    if (!db) {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(`rsg_cache_${key}`, jsonStr);
      }
      return;
    }

    await db.runAsync(
      `INSERT OR REPLACE INTO local_cache (key, value, updated_at) VALUES (?, ?, ?)`,
      [key, jsonStr, now]
    );
  },

  /**
   * Read cached value.
   */
  getCache: async <T>(key: string): Promise<T | null> => {
    const db = await getDatabase();

    if (!db) {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem(`rsg_cache_${key}`);
        return raw ? JSON.parse(raw) : null;
      }
      return null;
    }

    const row = await db.getFirstAsync<{ value: string }>(
      `SELECT value FROM local_cache WHERE key = ?`,
      [key]
    );
    return row ? JSON.parse(row.value) : null;
  },
};
