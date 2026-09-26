import { classifyItem, detectDueDate, formatAmount } from './classifyItem';

describe('classifyItem', () => {
  it('classifies URLs as links', () => {
    expect(classifyItem('Check this https://example.com/article')).toEqual({
      type: 'link',
      amount: null,
    });
  });

  it('classifies currency and keyword expenses', () => {
    expect(classifyItem('spent 500 on lunch')).toMatchObject({
      type: 'expense',
      amount: 500,
      direction: 'out',
    });
    expect(classifyItem('bought headphones for 1200')).toMatchObject({
      type: 'expense',
      amount: 1200,
      direction: 'out',
    });
    expect(classifyItem('got 500 from mom')).toMatchObject({
      type: 'expense',
      amount: 500,
      direction: 'in',
    });
    expect(classifyItem('bought milk')).toMatchObject({
      type: 'expense',
      amount: null,
      direction: 'out',
    });
  });

  it('classifies tasks with priority and due hints', () => {
    expect(classifyItem('Need to call dentist tomorrow')).toMatchObject({
      type: 'task',
      priority: 'low',
    });
    expect(classifyItem('URGENT finish slides')).toMatchObject({
      type: 'task',
      priority: 'high',
    });
    expect(classifyItem('Buy milk')).toMatchObject({
      type: 'task',
      amount: null,
    });
  });

  it('classifies contacts and quotes', () => {
    expect(classifyItem('Rahul 9876543210')).toMatchObject({ type: 'contact' });
    expect(classifyItem('"Something someone said"')).toMatchObject({ type: 'quote' });
  });

  it('defaults to note for plain text', () => {
    expect(classifyItem('Random thought about the project')).toEqual({
      type: 'note',
      amount: null,
    });
  });

  it('prioritizes links over expense keywords', () => {
    expect(classifyItem('Paid for this https://shop.example.com/item')).toEqual({
      type: 'link',
      amount: null,
    });
  });
});

describe('detectDueDate', () => {
  it('parses tomorrow', () => {
    const base = new Date('2026-08-21T10:00:00Z');
    const due = detectDueDate('call mom tomorrow', base);
    expect(due).not.toBeNull();
  });
});

describe('formatAmount', () => {
  it('formats whole numbers without decimals', () => {
    expect(formatAmount(500)).toBe('500');
  });
});

describe('capture regressions', () => {
  it.each([1900, 2000, 2026, 2100])('keeps real monetary amount %s', (amount) => {
    expect(classifyItem(`paid ₹${amount} rent`)).toMatchObject({ type: 'expense', amount });
  });
  it('keeps intended payments as tasks rather than recorded expenses', () => {
    expect(classifyItem('remind me to pay ₹2000 tomorrow')).toMatchObject({ type: 'task', amount: null });
    expect(classifyItem('buy milk for 50')).toMatchObject({ type: 'task', amount: null });
  });
  it('recognizes punctuation priority', () => {
    expect(classifyItem('Finish slides!!!')).toMatchObject({ type: 'task', priority: 'high' });
    expect(classifyItem('Finish slides!!')).toMatchObject({ type: 'task', priority: 'medium' });
  });
  it('rejects impossible dates instead of silently rolling into the next month', () => {
    const base = new Date(2026, 8, 25);
    expect(detectDueDate('submit due 31/02/2026', base)).toBeNull();
    expect(detectDueDate('submit due 29/02/2024', base)).not.toBeNull();
    expect(detectDueDate('submit due 29/02/2025', base)).toBeNull();
  });
  it('treats this Friday as today on Friday', () => {
    const base = new Date(2026, 8, 25);
    const result = new Date(detectDueDate('submit by friday', base)!);
    expect(result.getDate()).toBe(25);
  });
  it('rejects out-of-range relative dates without throwing', () => {
    expect(detectDueDate('in 999999999999999 days')).toBeNull();
  });
});


test('extracts price instead of purchased quantity', () => {
  expect(classifyItem('bought 2 coffees for ₹300')).toMatchObject({ type: 'expense', amount: 300 });
  expect(classifyItem('bought 2 coffees for 300')).toMatchObject({ type: 'expense', amount: 300 });
});

test('does not record time spent or casual thoughts as money', () => {
  expect(classifyItem('spent 2 hours studying')).toMatchObject({ type: 'note' });
  expect(classifyItem('got an idea for the project')).toMatchObject({ type: 'note' });
});
