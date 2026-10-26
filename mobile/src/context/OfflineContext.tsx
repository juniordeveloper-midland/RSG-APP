import React, { createContext, useContext, useState, useEffect } from 'react';
import { offlineQueue } from '../services/offlineQueue';
import { OfflineQueueItem } from '../types/offline';

interface OfflineContextType {
  pendingCount: number;
  isSyncing: boolean;
  queueItems: OfflineQueueItem[];
  syncNow: () => Promise<void>;
  retryFailed: () => Promise<void>;
  refreshQueue: () => Promise<void>;
}

const OfflineContext = createContext<OfflineContextType | undefined>(undefined);

export const OfflineProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [queueItems, setQueueItems] = useState<OfflineQueueItem[]>([]);

  const refreshQueue = async () => {
    const items = await offlineQueue.getAllItems();
    setQueueItems(items);
    const count = await offlineQueue.getPendingCount();
    setPendingCount(count);
  };

  useEffect(() => {
    refreshQueue();

    const unsubscribe = offlineQueue.subscribe((count, syncing) => {
      setPendingCount(count);
      setIsSyncing(syncing);
      refreshQueue();
    });

    return () => unsubscribe();
  }, []);

  const syncNow = async () => {
    await offlineQueue.syncPending();
    await refreshQueue();
  };

  const retryFailed = async () => {
    await offlineQueue.retryAll();
    await refreshQueue();
  };

  return (
    <OfflineContext.Provider
      value={{
        pendingCount,
        isSyncing,
        queueItems,
        syncNow,
        retryFailed,
        refreshQueue,
      }}
    >
      {children}
    </OfflineContext.Provider>
  );
};

export const useOffline = () => {
  const ctx = useContext(OfflineContext);
  if (!ctx) throw new Error('useOffline must be used inside OfflineProvider');
  return ctx;
};
