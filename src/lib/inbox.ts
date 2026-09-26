import type { Item, ItemType } from '@/types/item';

export type TaskView = 'all' | 'open' | 'today' | 'overdue' | 'done';
export type InboxSort = 'newest' | 'oldest' | 'priority';

export function selectInboxItems(
  items: Item[],
  type: 'all' | ItemType,
  search: string,
  taskView: TaskView = 'all',
  sort: InboxSort = 'newest',
  now = new Date(),
): Item[] {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime();
  const words = search.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const priority = { high: 3, medium: 2, low: 1 };
  return items.filter((item) => {
    if (type !== 'all' && item.type !== type) return false;
    const haystack = `${item.content} ${item.type} ${item.account ?? ''} ${item.source ?? ''}`.toLocaleLowerCase();
    if (!words.every((word) => haystack.includes(word))) return false;
    if (type !== 'task' || taskView === 'all') return true;
    if (taskView === 'done') return item.done;
    if (item.done) return false;
    if (taskView === 'open') return true;
    const due = item.due_at ? new Date(item.due_at).getTime() : NaN;
    return taskView === 'overdue' ? due < today : due >= today && due < tomorrow;
  }).sort((a, b) => {
    if (sort === 'priority') {
      const done = Number(a.done) - Number(b.done);
      if (done) return done;
      const rank = (priority[b.priority ?? 'low']) - (priority[a.priority ?? 'low']);
      if (rank) return rank;
      const due = (a.due_at ? Date.parse(a.due_at) : Infinity) - (b.due_at ? Date.parse(b.due_at) : Infinity);
      if (due && Number.isFinite(due)) return due;
      if (Boolean(a.due_at) !== Boolean(b.due_at)) return a.due_at ? -1 : 1;
    }
    const delta = Date.parse(b.occurred_at) - Date.parse(a.occurred_at);
    return (sort === 'oldest' ? -delta : delta) || a.id.localeCompare(b.id);
  });
}
