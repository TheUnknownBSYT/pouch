/**
 * items.ts — all Supabase reads/writes for the inbox
 *
 * createItem runs classifyItem() before insert.
 * subscribeToItems powers realtime updates in ItemsContext.
 */
import { Platform } from 'react-native';

import { classifyItem } from '@/lib/classifyItem';
import { supabase } from '@/lib/supabase';
import type { AccountSlug, Item, ItemSource, ItemType, TaskPriority, TransactionDirection } from '@/types/item';

export async function fetchItems(userId: string): Promise<Item[]> {
  const { data, error } = await supabase
    .from('items')
    .select('*')
    .eq('user_id', userId)
    .order('occurred_at', { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []) as Item[];
}

export async function createItem(
  userId: string,
  content: string,
  source: ItemSource = Platform.OS === 'web' ? 'web' : 'manual',
): Promise<Item> {
  const trimmed = content.trim();
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

  if (updates.content !== undefined && updates.type === undefined) {
    const classified = classifyItem(updates.content);
    payload.type = classified.type;
    payload.amount = classified.amount;
    payload.priority = classified.priority ?? updates.priority ?? null;
    payload.due_at = classified.due_at ?? updates.due_at ?? null;

    if (classified.type === 'expense') {
      payload.account = updates.account ?? classified.account ?? 'cash';
      payload.direction = updates.direction ?? classified.direction ?? 'out';
    } else {
      payload.account = null;
      payload.direction = null;
      payload.amount = null;
    }

    if (classified.type !== 'task') {
      payload.priority = null;
      payload.due_at = null;
    }
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
  }
  if (updates.type && updates.type !== 'task') {
    payload.priority = null;
    payload.due_at = null;
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
): Promise<Item> {
  if (type === 'expense') {
    const classified = classifyItem(current.content);
    return updateItem(id, {
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
    return updateItem(id, {
      type,
      amount: null,
      account: null,
      direction: null,
      priority: current.priority ?? classified.priority ?? 'low',
      due_at: current.due_at ?? classified.due_at ?? null,
    });
  }

  return updateItem(id, {
    type,
    amount: null,
    account: null,
    direction: null,
    priority: null,
    due_at: null,
  });
}