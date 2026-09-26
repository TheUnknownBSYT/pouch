/**
 * ItemsContext.tsx — single shared inbox list for all screens
 *
 * Inbox, item detail, and share-intent all use this so deletes/edits stay in sync.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { useAuth } from '@/contexts/AuthContext';
import { createItem, deleteItem, fetchItems, subscribeToItems, updateItem } from '@/lib/items';
import type { Item, ItemSource } from '@/types/item';

interface ItemsContextValue {
  items: Item[];
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  pullToRefresh: () => Promise<void>;
  addItem: (content: string, source?: ItemSource) => Promise<Item | undefined>;
  saveItem: (id: string, updates: Parameters<typeof updateItem>[1]) => Promise<Item>;
  toggleTaskDone: (item: Item) => Promise<void>;
  removeItem: (id: string) => Promise<void>;
}

const ItemsContext = createContext<ItemsContextValue | undefined>(undefined);

export function ItemsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!user) {
      setItems([]);
      setLoading(false);
      return;
    }

    try {
      setError(null);
      const nextItems = await fetchItems(user.id);
      setItems(nextItems);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load items');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!user) {
      return;
    }

    return subscribeToItems(user.id, refresh);
  }, [refresh, user]);

  const pullToRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
  }, [refresh]);

  const patchItem = useCallback((id: string, patch: Partial<Item>) => {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }, []);

  const removeItemLocal = useCallback((id: string) => {
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const addItem = useCallback(
    async (content: string, source?: ItemSource) => {
      if (!user) {
        return;
      }

      const item = await createItem(user.id, content, source);
      setItems((current) => [item, ...current.filter((row) => row.id !== item.id)]);
      return item;
    },
    [user],
  );

  const saveItem = useCallback(
    async (id: string, updates: Parameters<typeof updateItem>[1]) => {
      const updated = await updateItem(id, updates);
      patchItem(id, updated);
      return updated;
    },
    [patchItem],
  );

  const toggleTaskDone = useCallback(
    async (item: Item) => {
      if (item.type !== 'task') {
        return;
      }

      const nextDone = !item.done;
      patchItem(item.id, { done: nextDone });

      try {
        await updateItem(item.id, { done: nextDone });
      } catch (err) {
        patchItem(item.id, { done: item.done });
        throw err;
      }
    },
    [patchItem],
  );

  const removeItem = useCallback(
    async (id: string) => {
      removeItemLocal(id);
      try {
        await deleteItem(id);
      } catch (err) {
        await refresh();
        throw err;
      }
    },
    [refresh, removeItemLocal],
  );

  const value = useMemo(
    () => ({
      items,
      loading,
      refreshing,
      error,
      refresh,
      pullToRefresh,
      addItem,
      saveItem,
      toggleTaskDone,
      removeItem,
    }),
    [
      addItem,
      error,
      items,
      loading,
      pullToRefresh,
      refresh,
      refreshing,
      removeItem,
      saveItem,
      toggleTaskDone,
    ],
  );

  return <ItemsContext.Provider value={value}>{children}</ItemsContext.Provider>;
}

export function useItems() {
  const context = useContext(ItemsContext);
  if (!context) {
    throw new Error('useItems must be used within ItemsProvider');
  }
  return context;
}
