import { buildMonthlyCsv, computeAccountBalances } from './accounts';
import type { Item } from '@/types/item';

const expense = (amount: number, patch: Partial<Item> = {}): Item => ({
  id: '1', user_id: 'u', content: 'Lunch', type: 'expense', amount,
  account: 'cash', direction: 'out', source: 'web', done: false,
  priority: null, due_at: null, occurred_at: new Date(2026, 8, 25, 12).toISOString(),
  created_at: new Date(2026, 8, 25, 12).toISOString(), ...patch,
});

test('balances use integer paise', () => {
  expect(computeAccountBalances([expense(0.1), expense(0.2)])[0].balance).toBe(-0.3);
});

test('monthly exports carry forward opening balance', () => {
  const csv = buildMonthlyCsv([expense(1000, { direction: 'in', occurred_at: new Date(2026, 7, 1, 12).toISOString() }), expense(150)], 2026, 9);
  expect(csv).toContain('2026-09-25,Cash,"Lunch",,150,-150,850');
  expect(csv.split('\n')).toHaveLength(2);
});

test('export neutralizes spreadsheet formulas and quotes descriptions', () => {
  const csv = buildMonthlyCsv([expense(50, { content: '=HYPERLINK("bad")' })], 2026, 9);
  expect(csv).toContain('"\'=HYPERLINK(""bad"")"');
});

test('invalid amounts do not contaminate balances', () => {
  expect(computeAccountBalances([expense(NaN), expense(-5), expense(Infinity)])[0].balance).toBe(0);
});
