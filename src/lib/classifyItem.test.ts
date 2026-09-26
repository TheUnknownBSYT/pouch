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
