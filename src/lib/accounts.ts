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
    item.amount != null &&
    item.account != null &&
    item.direction != null
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
      bucket.balance += item.amount;
      bucket.income += item.amount;
    } else {
      bucket.balance -= item.amount;
      bucket.expense += item.amount;
    }
  }

  return (Object.keys(totals) as AccountSlug[]).map((slug) => ({
    slug,
    label: ACCOUNT_LABELS[slug],
    balance: totals[slug].balance,
    income: totals[slug].income,
    expense: totals[slug].expense,
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

export function buildMonthlyExportRows(items: Item[], account: AccountSlug): MonthlyExportRow[] {
  const chronological = items
    .filter(isExpenseItem)
    .filter((item) => item.account === account)
    .sort((a, b) => new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime());

  let runningBalance = 0;

  return chronological.map((item) => {
    const signedAmount = item.direction === 'in' ? item.amount : -item.amount;
    runningBalance += signedAmount;

    return {
      date: new Date(item.occurred_at).toISOString().slice(0, 10),
      account: ACCOUNT_LABELS[account],
      description: item.content.replace(/\s+/g, ' ').trim(),
      direction: item.direction,
      amount: item.amount,
      signedAmount,
      runningBalance,
    };
  });
}

export function buildMonthlyCsv(items: Item[], year: number, month: number): string {
  const monthItems = filterExpensesForMonth(items, year, month);
  const lines = ['Date,Account,Description,In,Out,Net,Running Balance'];

  for (const account of ['cash', 'gpay'] as AccountSlug[]) {
    const rows = buildMonthlyExportRows(monthItems, account);
    for (const row of rows) {
      const inAmount = row.direction === 'in' ? formatAmount(row.amount) : '';
      const outAmount = row.direction === 'out' ? formatAmount(row.amount) : '';
      lines.push(
        [
          row.date,
          row.account,
          `"${row.description.replace(/"/g, '""')}"`,
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
