import { selectInboxItems } from './inbox';
import type { Item } from '@/types/item';

const item = (id: string, patch: Partial<Item> = {}): Item => ({
  id, user_id: 'u', content: 'Read lecture notes', type: 'task', done: false,
  amount: null, account: null, direction: null, source: 'web', priority: 'low',
  due_at: null, occurred_at: '2026-09-25T10:00:00Z', created_at: '2026-09-25T10:00:00Z', ...patch,
});
const now = new Date(2026, 8, 25, 18);
const due = (day: number) => new Date(2026, 8, day, 12).toISOString();

test('today does not mark this morning overdue and excludes completed tasks', () => {
  const items = [item('today', { due_at: due(25) }), item('late', { due_at: due(24) }), item('done', { due_at: due(25), done: true })];
  expect(selectInboxItems(items, 'task', '', 'today', 'newest', now).map(x => x.id)).toEqual(['today']);
  expect(selectInboxItems(items, 'task', '', 'overdue', 'newest', now).map(x => x.id)).toEqual(['late']);
});

test('multiword search matches across content and account, independent of word order', () => {
  const items = [item('a', { type: 'expense', content: 'Lunch with Rahul', account: 'gpay' })];
  expect(selectInboxItems(items, 'all', 'GPAY lunch')).toHaveLength(1);
  expect(selectInboxItems(items, 'task', 'lunch')).toHaveLength(0);
});

test('priority order puts completed tasks last and dated tasks before undated peers', () => {
  const items = [item('low'), item('done', { done: true, priority: 'high' }), item('high', { priority: 'high' }), item('due', { priority: 'high', due_at: due(26) })];
  expect(selectInboxItems(items, 'task', '', 'all', 'priority').map(x => x.id)).toEqual(['due', 'high', 'low', 'done']);
  expect(items[0].id).toBe('low');
});
