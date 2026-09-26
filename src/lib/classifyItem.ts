/**
 * classifyItem.ts — auto-detection when you save something
 *
 * Called from items.ts on create/update. Pure functions, no network.
 * Order matters: link → expense → contact → quote → task → note.
 *
 * To tweak behavior: edit patterns below, then run `npm test`.
 * See _support/docs/HOW_IT_WORKS.md for replacing this with a neural net later.
 */
import type {
  AccountSlug,
  ClassifiedItem,
  ItemType,
  TaskPriority,
  TransactionDirection,
} from '@/types/item';

const URL_PATTERN =
  /(?:https?:\/\/|www\.)[^\s]+|[a-z0-9-]+\.(com|org|net|io|app|dev|co|in|me|tv|ly)(?:\/[^\s]*)?/i;

const PHONE_PATTERN =
  /(?:\+91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}|\b[6-9]\d{9}\b|\+\d{1,3}[\s-]?\d{6,14}\b/;

const QUOTE_PATTERN = /^["'「『].+["'」』]$/s;
const FORWARD_PATTERN = /^>\s?.+/m;

const EXPENSE_IN_PATTERN =
  /\b(got|received|earned|made|refund|refunded|salary|income|credited|credit)\b/i;
const EXPENSE_OUT_PATTERN =
  /\b(spent|paid|bought|purchase|purchased|cost|expense|lost|charged|charge|debit|withdraw|withdrew|ordered)\b/i;

const EXPENSE_AMOUNT_PATTERNS = [
  // Prefer explicit currency/price over quantities: "bought 2 coffees for ₹300".
  /(?:₹|\brs\.?\s*|\binr\s*)([\d,]+(?:\.\d{1,2})?)/i,
  /\b([\d,]+(?:\.\d{1,2})?)\s*(?:₹|rs\.?\b|inr\b)/i,
  /(?:\bfor\b|\bat\b|@)\s+([\d,]+(?:\.\d{1,2})?)\b/i,
  /\b(?:spent|paid|bought|buy|purchase|cost|got|received|earned|made|lost|charged|charge|ordered)\s+([\d,]+(?:\.\d{1,2})?)/i,
  /\b([\d,]+(?:\.\d{1,2})?)\s+on\b/i,
  /\b([\d,]+(?:\.\d{1,2})?)\s+for\b/i,
];

const GPAY_PATTERN = /\b(gpay|google pay|upi|phonepe|paytm|pay to)\b/i;

const TASK_PATTERNS = [
  /\b(todo|to-do|need to|remember to|don't forget to|dont forget to|remind me to)\b/i,
  /\b(asap|urgent)\b/i,
  /^[-*•]\s+\S/i,
  /^\[\s?[xX ]?\]\s+\S/i,
  /^(call|buy|send|email|text|pick up|pickup|book|schedule|finish|complete|remind|check|fix|update|write|read|watch|listen|meet|go to|get|make|do|try|start|stop|cancel|return|submit|apply|download|install|setup|set up|clean|organize|organise|pack|unpack|move|drop off|dropoff)\b/i,
];

const HIGH_PRIORITY_PATTERN = /\b(asap|urgent|critical)\b|!!!|\bimportant!/i;
const MEDIUM_PRIORITY_PATTERN = /\b(important|priority)\b|!!/i;

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

function parseAmount(raw: string): number | null {
  const normalized = raw.replace(/,/g, '');
  const value = Number.parseFloat(normalized);
  if (!Number.isFinite(value) || value <= 0) {
    return null;
  }

  return value;
}

function findAnyAmount(content: string): number | null {
  const matches = content.match(/\b([\d,]+(?:\.\d{1,2})?)\b/g) ?? [];
  for (const match of matches) {
    const amount = parseAmount(match);
    if (amount !== null) {
      return amount;
    }
  }
  return null;
}

export function detectAccount(content: string): AccountSlug {
  return GPAY_PATTERN.test(content) ? 'gpay' : 'cash';
}

export function detectDirection(content: string): TransactionDirection {
  if (EXPENSE_IN_PATTERN.test(content) && !EXPENSE_OUT_PATTERN.test(content)) {
    return 'in';
  }
  if (EXPENSE_OUT_PATTERN.test(content)) {
    return 'out';
  }
  if (EXPENSE_IN_PATTERN.test(content)) {
    return 'in';
  }
  return 'out';
}

export function detectPriority(content: string): TaskPriority | null {
  if (HIGH_PRIORITY_PATTERN.test(content)) {
    return 'high';
  }
  if (MEDIUM_PRIORITY_PATTERN.test(content)) {
    return 'medium';
  }
  return 'low';
}

export function detectDueDate(content: string, baseDate = new Date()): string | null {
  const lower = content.toLowerCase();
  const startOfDay = (date: Date) => {
    const next = new Date(date);
    next.setHours(12, 0, 0, 0);
    return next;
  };

  if (/\btoday\b/.test(lower)) {
    return startOfDay(baseDate).toISOString();
  }

  if (/\btomorrow\b/.test(lower)) {
    const date = startOfDay(baseDate);
    date.setDate(date.getDate() + 1);
    return date.toISOString();
  }

  const inDays = lower.match(/\bin\s+(\d+)\s+days?\b/);
  if (inDays?.[1]) {
    const date = startOfDay(baseDate);
    date.setDate(date.getDate() + Number.parseInt(inDays[1], 10));
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  const byWeekday = lower.match(/\b(?:by|on|this)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/);
  if (byWeekday?.[1]) {
    const target = WEEKDAYS.indexOf(byWeekday[1]);
    const date = startOfDay(baseDate);
    const current = date.getDay();
    let delta = target - current;
    if (delta < 0) {
      delta += 7;
    }
    date.setDate(date.getDate() + delta);
    return date.toISOString();
  }

  const dueMatch = lower.match(/\bdue\s+(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/);
  if (dueMatch) {
    const day = Number.parseInt(dueMatch[1], 10);
    const month = Number.parseInt(dueMatch[2], 10) - 1;
    const year = dueMatch[3]
      ? Number.parseInt(dueMatch[3].length === 2 ? `20${dueMatch[3]}` : dueMatch[3], 10)
      : baseDate.getFullYear();
    const date = startOfDay(new Date(year, month, day));
    if (date.getFullYear() === year && date.getMonth() === month && date.getDate() === day) {
      return date.toISOString();
    }
  }

  return null;
}

function detectContact(content: string): boolean {
  return PHONE_PATTERN.test(content) && !URL_PATTERN.test(content);
}

function detectQuote(content: string): boolean {
  const trimmed = content.trim();
  return QUOTE_PATTERN.test(trimmed) || FORWARD_PATTERN.test(trimmed);
}

function detectExpense(content: string): ClassifiedItem | null {
  const hasCurrency = /₹|\brs\.?\b|\binr\b/i.test(content);
  if (!hasCurrency && /\b(?:spent|lost)\s+\d+(?:\.\d+)?\s+(?:hours?|minutes?|seconds?|days?)\b/i.test(content)) {
    return null;
  }
  const hasExpenseSignal =
    EXPENSE_IN_PATTERN.test(content) ||
    EXPENSE_OUT_PATTERN.test(content) ||
    /\b\d+\s+on\b/i.test(content) ||
    /\b\d+\s+for\b/i.test(content) ||
    /[₹]|(?:\brs\.?\b|\binr\b)/i.test(content);

  if (!hasExpenseSignal) {
    return null;
  }

  for (const pattern of EXPENSE_AMOUNT_PATTERNS) {
    const match = content.match(pattern);
    if (!match?.[1]) {
      continue;
    }

    const amount = parseAmount(match[1]);
    if (amount !== null) {
      return {
        type: 'expense',
        amount,
        account: detectAccount(content),
        direction: detectDirection(content),
      };
    }
  }

  const fallbackAmount = findAnyAmount(content);
  if (fallbackAmount !== null) {
    return {
      type: 'expense',
      amount: fallbackAmount,
      account: detectAccount(content),
      direction: detectDirection(content),
    };
  }

  if (EXPENSE_OUT_PATTERN.test(content) || /\b(refund|refunded|salary|income|credited)\b/i.test(content)) {
    return {
      type: 'expense',
      amount: null,
      account: detectAccount(content),
      direction: detectDirection(content),
    };
  }

  return null;
}

function detectTask(content: string): boolean {
  const trimmed = content.trim();
  if (/\bbought\b/i.test(trimmed) && findAnyAmount(trimmed) !== null) {
    return false;
  }
  return TASK_PATTERNS.some((pattern) => pattern.test(trimmed));
}

export function classifyItem(content: string): ClassifiedItem {
  const trimmed = content.trim();
  if (!trimmed) {
    return { type: 'unsorted', amount: null };
  }

  if (URL_PATTERN.test(trimmed)) {
    return { type: 'link', amount: null };
  }

  // An explicit reminder is an intention, even when it mentions a price.
  if (/^(?:todo\b|to-do\b|need to\b|remember to\b|remind me to\b|don['’]?t forget to\b|buy\b|pay\b)/i.test(trimmed)) {
    return { type: 'task', amount: null, priority: detectPriority(trimmed), due_at: detectDueDate(trimmed) };
  }

  const expense = detectExpense(trimmed);
  if (expense) {
    return expense;
  }

  if (detectContact(trimmed)) {
    return { type: 'contact', amount: null };
  }

  if (detectQuote(trimmed)) {
    return { type: 'quote', amount: null };
  }

  if (detectTask(trimmed)) {
    return {
      type: 'task',
      amount: null,
      priority: detectPriority(trimmed),
      due_at: detectDueDate(trimmed),
    };
  }

  return { type: 'note', amount: null };
}

export function itemTypeLabel(type: ItemType): string {
  switch (type) {
    case 'link':
      return 'Link';
    case 'task':
      return 'Task';
    case 'expense':
      return 'Expense';
    case 'contact':
      return 'Contact';
    case 'quote':
      return 'Quote';
    case 'unsorted':
      return 'Unsorted';
    default:
      return 'Note';
  }
}

export function formatAmount(amount: number): string {
  return amount % 1 === 0 ? String(amount) : amount.toFixed(2);
}

export function formatSignedAmount(amount: number, direction: TransactionDirection): string {
  const prefix = direction === 'in' ? '+' : '-';
  return `${prefix}${formatAmount(amount)}`;
}

export function formatDueDate(iso: string): string {
  const date = new Date(iso);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(date);
  due.setHours(0, 0, 0, 0);
  const diffDays = Math.round((due.getTime() - today.getTime()) / 86_400_000);

  if (diffDays === 0) {
    return 'Today';
  }
  if (diffDays === 1) {
    return 'Tomorrow';
  }
  if (diffDays < 0) {
    return `${Math.abs(diffDays)}d overdue`;
  }

  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
