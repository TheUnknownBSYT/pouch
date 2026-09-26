/**
 * items.ts — all Supabase reads/writes for the inbox
 *
 * createItem runs classifyItem() before insert.
 * subscribeToItems powers realtime updates in ItemsContext.
 */
import { Platform } from 'react-native';

import { classifyItem } from '@/lib/classifyItem';
import { supabase } from '@/lib/supabase';
import type { Item, ItemSource, ItemType } from '@/types/item';

export async function fetchItems(userId: string): Promise<Item[]> {
  // PostgREST caps a response at 1,000 rows by default. Fetch every page
  // so older captures and account balances never silently disappear.
  const items: Item[] = [];
  const pageSize = 500;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase.from('items').select('*')
      .eq('user_id', userId)
      .order('occurred_at', { ascending: false })
      .order('id', { ascending: false })
      .range(offset, offset + pageSize - 1);
    if (error) throw error;
    const page = (data ?? []) as Item[];
    items.push(...page);
    if (page.length < pageSize) return items;
  }
}

export async function createItem(
  userId: string,
  content: string,
  source: ItemSource = Platform.OS === 'web' ? 'web' : 'manual',
): Promise<Item> {
  const trimmed = content.trim();
  if (!trimmed) throw new Error('Content cannot be empty');
  const classified = classifyItem(trimmed);
  const now = new Date().toISOString();

  const payload: Record<string, unknown> = {
    user_id: userId,
    content: trimmed,
    type: classified.type,
    amount: classified.amount,
    source,
    occurred_at: now,
    priority: classified.priority ?? null,
    due_at: classified.due_at ?? null,
  };

  if (classified.type === 'expense') {
    payload.account = classified.account ?? 'cash';
    payload.direction = classified.direction ?? 'out';
  }

  const { data, error } = await supabase.from('items').insert(payload).select('*').single();

  if (error) {
    throw error;
  }

  return data as Item;
}

export async function updateItem(
  id: string,
  updates: Partial<
    Pick<
      Item,
      | 'content'
      | 'done'
      | 'type'
      | 'amount'
      | 'account'
      | 'direction'
      | 'occurred_at'
      | 'priority'
      | 'due_at'
    >
  >,
): Promise<Item> {
  const payload: Record<string, unknown> = { ...updates };

  // Classification is a capture-time suggestion. Text edits must preserve
  // manual type, due-date, priority, and amount choices.
  if (updates.content !== undefined) {
    payload.content = updates.content.trim();
    if (!payload.content) throw new Error('Content cannot be empty');
  }
  if (updates.amount != null && (!Number.isFinite(updates.amount) || updates.amount <= 0)) {
    throw new Error('Enter a valid positive amount');
  }

  if (updates.type === 'expense' && payload.account == null) {
    payload.account = 'cash';
  }
  if (updates.type === 'expense' && payload.direction == null) {
    payload.direction = 'out';
  }
  if (updates.type && updates.type !== 'expense') {
    payload.account = null;
    payload.direction = null;
    payload.amount = null;
  }
  if (updates.type && updates.type !== 'task') {
    payload.priority = null;
    payload.due_at = null;
    payload.done = false;
  }

  const { data, error } = await supabase
    .from('items')
    .update(payload)
    .eq('id', id)
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  return data as Item;
}

export async function deleteItem(id: string): Promise<void> {
  const { error } = await supabase.from('items').delete().eq('id', id);
  if (error) {
    throw error;
  }
}

export function subscribeToItems(userId: string, onChange: () => void) {
  const channel = supabase
    .channel(`items:${userId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'items',
        filter: `user_id=eq.${userId}`,
      },
      () => {
        onChange();
      },
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

export function setItemType(
  id: string,
  type: ItemType,
  current: Pick<Item, 'content' | 'amount' | 'account' | 'direction' | 'priority' | 'due_at'>,
  save: typeof updateItem = updateItem,
): Promise<Item> {
  if (type === 'expense') {
    const classified = classifyItem(current.content);
    return save(id, {
      type,
      amount: classified.amount ?? current.amount ?? null,
      account: current.account ?? classified.account ?? 'cash',
      direction: current.direction ?? classified.direction ?? 'out',
      priority: null,
      due_at: null,
    });
  }

  if (type === 'task') {
    const classified = classifyItem(current.content);
    return save(id, {
      type,
      amount: null,
      account: null,
      direction: null,
      priority: current.priority ?? classified.priority ?? 'low',
      due_at: current.due_at ?? classified.due_at ?? null,
    });
  }

  return save(id, {
    type,
    amount: null,
    account: null,
    direction: null,
    priority: null,
    due_at: null,
  });
}