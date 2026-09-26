/**
 * ItemsContext.tsx — single shared inbox list for all screens
 *
 * Inbox, item detail, and share-intent all use this so deletes/edits stay in sync.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

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
  addItem: (content: string, source?: ItemSource) => Promise<Item>;
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
  const generation = useRef(0);
  const pending = useRef(new Set<string>());
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; generation.current += 1; };
  }, []);

  const refresh = useCallback(async () => {
    if (!user) {
      setItems([]);
      setLoading(false);
      return;
    }

    const request = ++generation.current;
    try {
      setError(null);
      const nextItems = await fetchItems(user.id);
      if (mounted.current && request === generation.current && pending.current.size === 0) {
        setItems(nextItems);
      }
    } catch (err) {
      if (mounted.current && request === generation.current) {
        setError(err instanceof Error ? err.message : 'Failed to load items');
      }
    } finally {
      if (mounted.current && request === generation.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [user]);

  useEffect(() => {
    // Fetching external data on mount is intentional; refresh also clears old errors.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
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
        throw new Error('Sign in before saving an item');
      }
      const key = `create:${content.trim()}`;
      if (pending.current.has(key)) throw new Error('This capture is already being saved');
      pending.current.add(key);
      generation.current += 1;
      try {
        const item = await createItem(user.id, content, source);
        if (mounted.current) setItems((current) => [item, ...current.filter((row) => row.id !== item.id)]);
        return item;
      } finally {
        pending.current.delete(key);
        if (mounted.current) void refresh();
      }
    },
    [user, refresh],
  );

  const saveItem = useCallback(
    async (id: string, updates: Parameters<typeof updateItem>[1]) => {
      if (pending.current.has(id)) throw new Error('This item is still saving');
      pending.current.add(id);
      generation.current += 1;
      try {
        const updated = await updateItem(id, updates);
        if (mounted.current) patchItem(id, updated);
        return updated;
      } finally {
        pending.current.delete(id);
        if (mounted.current) void refresh();
      }
    },
    [patchItem, refresh],
  );

  const toggleTaskDone = useCallback(
    async (item: Item) => {
      if (item.type !== 'task') {
        return;
      }

      if (pending.current.has(item.id)) return;
      const nextDone = !item.done;
      patchItem(item.id, { done: nextDone });

      try {
        await saveItem(item.id, { done: nextDone });
      } catch (err) {
        patchItem(item.id, { done: item.done });
        throw err;
      }
    },
    [patchItem, saveItem],
  );

  const removeItem = useCallback(
    async (id: string) => {
      if (pending.current.has(id)) throw new Error('This item is still saving');
      pending.current.add(id);
      generation.current += 1;
      const removed = items.find((item) => item.id === id);
      removeItemLocal(id);
      try {
        await deleteItem(id);
      } catch (err) {
        if (mounted.current && removed) {
          setItems((current) => [...current.filter((item) => item.id !== id), removed]);
        }
        throw err;
      } finally {
        pending.current.delete(id);
        if (mounted.current) void refresh();
      }
    },
    [items, refresh, removeItemLocal],
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
