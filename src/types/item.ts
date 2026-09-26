/**
 * types/item.ts — shapes stored in Supabase and used in the UI
 */
export type ItemType =
  | 'note'
  | 'link'
  | 'task'
  | 'expense'
  | 'unsorted'
  | 'contact'
  | 'quote';

export type ItemSource =
  | 'share-instagram'
  | 'share-youtube'
  | 'share-whatsapp'
  | 'manual'
  | 'web';

export type AccountSlug = 'cash' | 'gpay';

export type TransactionDirection = 'in' | 'out';

export type TaskPriority = 'low' | 'medium' | 'high';

export interface Item {
  id: string;
  user_id: string;
  content: string;
  type: ItemType;
  amount: number | null;
  source: string | null;
  done: boolean;
  occurred_at: string;
  account: AccountSlug | null;
  direction: TransactionDirection | null;
  priority: TaskPriority | null;
  due_at: string | null;
  created_at: string;
}

export interface ClassifiedItem {
  type: ItemType;
  amount: number | null;
  account?: AccountSlug | null;
  direction?: TransactionDirection | null;
  priority?: TaskPriority | null;
  due_at?: string | null;
}

export const ACCOUNT_LABELS: Record<AccountSlug, string> = {
  cash: 'Cash',
  gpay: 'GPay',
};

export const PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
};
