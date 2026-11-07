import AsyncStorage from '@react-native-async-storage/async-storage';
import { randomUUID } from 'expo-crypto';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';

import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { buildCapture } from '@/lib/capture';
import { CaptureQueue } from '@/lib/capture-queue';
import { deleteItem, fetchItems, subscribeToItems, syncCapture, updateItem } from '@/lib/items';
import type { Item, ItemSource, ItemType } from '@/types/item';

interface ItemsContextValue {
  deleteAccount: () => Promise<void>;
  items: Item[];
  pendingIds: Set<string>;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  pullToRefresh: () => Promise<void>;
  addItem: (content: string, source?: ItemSource, type?: ItemType) => Promise<Item>;
  saveItem: (id: string, updates: Parameters<typeof updateItem>[1]) => Promise<Item>;
  toggleTaskDone: (item: Item) => Promise<void>;
  removeItem: (id: string) => Promise<void>;
}

const ItemsContext = createContext<ItemsContextValue | undefined>(undefined);
// One disk-write lock per account, including across sign-out/sign-in transitions.
const queues = new Map<string, CaptureQueue>();
function queueFor(userId: string) {
  if (!queues.has(userId)) queues.set(userId, new CaptureQueue(userId, AsyncStorage));
  return queues.get(userId)!;
}
function mergeItems(remote: Item[], local: Item[]) {
  const rows = new Map(remote.map((item) => [item.id, item]));
  local.forEach((item) => rows.set(item.id, item));
  return [...rows.values()].sort((a, b) => b.occurred_at.localeCompare(a.occurred_at));
}

export function ItemsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id;
  const queue = useMemo(() => userId ? queueFor(userId) : null, [userId]);
  const [items, setItems] = useState<Item[]>([]);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const active = useRef(true);
  const revision = useRef(0);
  const taskUpdates = useRef(new Set<string>());
  const cacheReady = useRef(false);
  const cacheWrites = useRef<Promise<unknown>>(Promise.resolve());

  const sync = useCallback(async () => {
    if (!queue) return;
    try {
      await queue.flush(syncCapture, (item) => {
        if (!active.current) return;
        revision.current += 1;
        setItems((current) => mergeItems(current, [item]));
      }, () => active.current);
      if (active.current) setError(null);
    } catch {
      if (active.current) setError('Saved on this device. Sync will retry when you’re connected.');
    } finally {
      const pending = await queue.list();
      if (active.current) setPendingIds(new Set(pending.map((item) => item.id)));
    }
  }, [queue]);

  const refresh = useCallback(async () => {
    if (!userId || !queue) { setLoading(false); return; }
    try {
      await sync();
      const version = revision.current;
      const remote = await fetchItems(userId);
      const pending = await queue.list();
      if (!active.current) return;
      if (version === revision.current && !taskUpdates.current.size) setItems(mergeItems(remote, pending));
      setPendingIds(new Set(pending.map((item) => item.id)));
      if (!pending.length) setError(null);
    } catch {
      if (active.current) setError('Couldn’t refresh. Your saved captures are still here. Pull down to retry.');
    } finally {
      if (active.current) { setLoading(false); setRefreshing(false); }
    }
  }, [queue, sync, userId]);

  useEffect(() => {
    active.current = true;
    void (async () => {
      try {
        if (queue) {
          const pending = await queue.list();
          let cached: Item[] = [];
          try {
            const raw = await AsyncStorage.getItem(`pouch:inbox:v1:${userId}`);
            const parsed: unknown = raw ? JSON.parse(raw) : [];
            if (Array.isArray(parsed)) cached = parsed.filter((row) => row?.user_id === userId && typeof row.content === 'string' && typeof row.occurred_at === 'string');
          } catch { /* The durable capture queue remains the source of unsynced data. */ }
          if (!active.current) return;
          cacheReady.current = true;
          setItems((current) => mergeItems(cached, mergeItems(current, pending)));
          setPendingIds(new Set(pending.map((item) => item.id)));
          if (cached.length || pending.length) setLoading(false);
        }
      } catch {
        if (active.current) setError('Couldn’t read saved captures. Keep the app installed and try reopening it.');
      }
      if (active.current) void refresh();
    })();
    const listener = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refresh();
    });
    const retry = setInterval(() => { void sync().catch(() => {}); }, 30000);
    return () => { active.current = false; listener.remove(); clearInterval(retry); };
  }, [queue, refresh, sync, userId]);

  useEffect(() => {
    if (!userId || !cacheReady.current) return;
    const snapshot = JSON.stringify(items);
    cacheWrites.current = cacheWrites.current.catch(() => {}).then(() => AsyncStorage.setItem(`pouch:inbox:v1:${userId}`, snapshot));
    void cacheWrites.current.catch(() => {});
  }, [items, userId]);

  useEffect(() => userId ? subscribeToItems(userId, () => void refresh()) : undefined, [refresh, userId]);

  const pullToRefresh = useCallback(async () => { setRefreshing(true); await refresh(); }, [refresh]);

  const addItem = useCallback(async (content: string, source?: ItemSource, type?: ItemType) => {
    if (!userId || !queue) throw new Error('Sign in to save this item');
    const item = buildCapture(userId, randomUUID(), content, source ?? (Platform.OS === 'web' ? 'web' : 'manual'), type);
    await queue.enqueue(item);
    if (active.current) {
      revision.current += 1;
      setItems((current) => mergeItems(current, [item]));
      setPendingIds((current) => new Set([...current, item.id]));
      void sync().catch(() => {});
    }
    return item;
  }, [queue, sync, userId]);

  const ensureSynced = useCallback((id: string) => {
    if (pendingIds.has(id)) throw new Error('This capture is waiting to sync. You can edit it once connected.');
  }, [pendingIds]);

  const saveItem = useCallback(async (id: string, updates: Parameters<typeof updateItem>[1]) => {
    ensureSynced(id);
    const updated = await updateItem(id, updates);
    revision.current += 1;
    setItems((current) => mergeItems(current, [updated]));
    return updated;
  }, [ensureSynced]);

  const toggleTaskDone = useCallback(async (item: Item) => {
    if (item.type !== 'task' || taskUpdates.current.has(item.id)) return;
    ensureSynced(item.id);
    taskUpdates.current.add(item.id);
    revision.current += 1;
    setItems((current) => current.map((row) => row.id === item.id ? { ...row, done: !item.done } : row));
    try { await updateItem(item.id, { done: !item.done }); }
    catch (err) {
      setItems((current) => current.map((row) => row.id === item.id ? { ...row, done: item.done } : row));
      throw err;
    } finally {
      revision.current += 1;
      taskUpdates.current.delete(item.id);
    }
  }, [ensureSynced]);

  const removeItem = useCallback(async (id: string) => {
    ensureSynced(id);
    await deleteItem(id);
    revision.current += 1;
    setItems((current) => current.filter((item) => item.id !== id));
  }, [ensureSynced]);

  const deleteAccount = async () => {
    if (!userId) throw new Error('Sign in first.');
    const { data, error: failure } = await supabase.functions.invoke('delete-account', { body: {} });
    if (failure || !data?.deleted) throw new Error('Account deletion failed. Check your connection and try again.');
    active.current = false;
    // Drain existing writes before removing this account's device data.
    await queue?.flush(syncCapture, () => {}, () => false).catch(() => {});
    await cacheWrites.current.catch(() => {});
    try {
      await AsyncStorage.multiRemove([`pouch:outbox:v1:${userId}`, `pouch:inbox:v1:${userId}`, `pouch:draft:v1:${userId}`, 'pouch:last-email']);
      if (Platform.OS === 'web' && typeof window !== 'undefined') window.localStorage.removeItem('pouch:last-email');
    } finally {
      queues.delete(userId);
      setItems([]);
      await supabase.auth.signOut({ scope: 'local' });
    }
  };

  return <ItemsContext.Provider value={{ deleteAccount, items, pendingIds, loading, refreshing, error, refresh, pullToRefresh, addItem, saveItem, toggleTaskDone, removeItem }}>{children}</ItemsContext.Provider>;
}

export function useItems() {
  const context = useContext(ItemsContext);
  if (!context) throw new Error('useItems must be used within ItemsProvider');
  return context;
}
