import { formatAmount } from '@/lib/classifyItem';
import type { AccountSlug, Item, TransactionDirection } from '@/types/item';
import { ACCOUNT_LABELS } from '@/types/item';

export interface AccountBalance {
  slug: AccountSlug;
  label: string;
  balance: number;
  income: number;
  expense: number;
}

export interface MonthlyExportRow {
  date: string;
  account: string;
  description: string;
  direction: TransactionDirection;
  amount: number;
  signedAmount: number;
  runningBalance: number;
}

function isExpenseItem(item: Item): item is Item & { amount: number; account: AccountSlug; direction: TransactionDirection } {
  return (
    item.type === 'expense' &&
    item.amount != null && Number.isFinite(item.amount) && item.amount > 0 &&
    (item.account === 'cash' || item.account === 'gpay') &&
    (item.direction === 'in' || item.direction === 'out')
  );
}

export function computeAccountBalances(items: Item[]): AccountBalance[] {
  const totals: Record<AccountSlug, { balance: number; income: number; expense: number }> = {
    cash: { balance: 0, income: 0, expense: 0 },
    gpay: { balance: 0, income: 0, expense: 0 },
  };

  for (const item of items) {
    if (!isExpenseItem(item)) {
      continue;
    }

    const bucket = totals[item.account];
    if (item.direction === 'in') {
      bucket.balance += Math.round(item.amount * 100);
      bucket.income += Math.round(item.amount * 100);
    } else {
      bucket.balance -= Math.round(item.amount * 100);
      bucket.expense += Math.round(item.amount * 100);
    }
  }

  return (Object.keys(totals) as AccountSlug[]).map((slug) => ({
    slug,
    label: ACCOUNT_LABELS[slug],
    balance: totals[slug].balance / 100,
    income: totals[slug].income / 100,
    expense: totals[slug].expense / 100,
  }));
}

export function filterExpensesForMonth(items: Item[], year: number, month: number): Item[] {
  return items
    .filter(isExpenseItem)
    .filter((item) => {
      const date = new Date(item.occurred_at);
      return date.getFullYear() === year && date.getMonth() + 1 === month;
    })
    .sort((a, b) => new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime());
}

export function buildMonthlyExportRows(items: Item[], account: AccountSlug, openingBalance = 0): MonthlyExportRow[] {
  const chronological = items
    .filter(isExpenseItem)
    .filter((item) => item.account === account)
    .sort((a, b) => new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime());

  let runningPaise = Math.round(openingBalance * 100);

  return chronological.map((item) => {
    const signedPaise = Math.round(item.amount * 100) * (item.direction === 'in' ? 1 : -1);
    const signedAmount = signedPaise / 100;
    runningPaise += signedPaise;
    const date = new Date(item.occurred_at);

    return {
      date: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`,
      account: ACCOUNT_LABELS[account],
      description: item.content.replace(/\s+/g, ' ').trim(),
      direction: item.direction,
      amount: item.amount,
      signedAmount,
      runningBalance: runningPaise / 100,
    };
  });
}

export function buildMonthlyCsv(items: Item[], year: number, month: number): string {
  const monthItems = filterExpensesForMonth(items, year, month);
  const lines = ['Date,Account,Description,In,Out,Net,Running Balance'];

  const monthStart = new Date(year, month - 1, 1).getTime();
  const openingBalances = computeAccountBalances(items.filter((item) => Date.parse(item.occurred_at) < monthStart));
  for (const account of ['cash', 'gpay'] as AccountSlug[]) {
    const rows = buildMonthlyExportRows(monthItems, account, openingBalances.find((row) => row.slug === account)?.balance ?? 0);
    for (const row of rows) {
      const inAmount = row.direction === 'in' ? formatAmount(row.amount) : '';
      const outAmount = row.direction === 'out' ? formatAmount(row.amount) : '';
      lines.push(
        [
          row.date,
          row.account,
          csvText(row.description),
          inAmount,
          outAmount,
          formatAmount(row.signedAmount),
          formatAmount(row.runningBalance),
        ].join(','),
      );
    }
  }

  return lines.join('\n');
}

export function monthLabel(year: number, month: number): string {
  return new Date(year, month - 1, 1).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });
}

// Quoting alone does not prevent spreadsheet formula execution.
function csvText(value: string): string {
  const safe = /^[=+@\-\t\r]/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}
