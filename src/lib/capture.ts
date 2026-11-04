import { classifyItem, detectAccount, detectDirection, detectDueDate, detectPriority } from './classifyItem';
import type { ClassifiedItem, Item, ItemSource, ItemType } from '../types/item';

export const MAX_CAPTURE_LENGTH = 20000;

/** Shared by preview and save: a correction never leaks fields from another type. */
export function classifyCapture(content: string, override?: ItemType): ClassifiedItem {
  const result = classifyItem(content);
  if (!override || override === result.type) return result;
  if (override === 'expense') return {
    type: override, amount: result.amount,
    account: detectAccount(content), direction: detectDirection(content),
  };
  if (override === 'task') return {
    type: override, amount: null,
    priority: detectPriority(content), due_at: detectDueDate(content),
  };
  return { type: override, amount: null };
}

export function buildCapture(userId: string, id: string, content: string, source: ItemSource, override?: ItemType): Item {
  const trimmed = content.trim();
  if (!trimmed) throw new Error('Write something to save first.');
  if (trimmed.length > MAX_CAPTURE_LENGTH) throw new Error('Please split this into notes under 20,000 characters.');
  const result = classifyCapture(trimmed, override);
  const now = new Date().toISOString();
  return {
    id, user_id: userId, content: trimmed, source, type: result.type,
    amount: result.amount, account: result.account ?? null, direction: result.direction ?? null,
    priority: result.priority ?? null, due_at: result.due_at ?? null,
    done: false, occurred_at: now, created_at: now,
  };
}
