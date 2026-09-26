import { createItem, fetchItems, setItemType, updateItem } from './items';
import { supabase } from './supabase';

jest.mock('./supabase', () => ({ supabase: { from: jest.fn() } }));

const query = {
  select: jest.fn(), eq: jest.fn(), order: jest.fn(), range: jest.fn(),
  update: jest.fn(), insert: jest.fn(), single: jest.fn(),
};

beforeEach(() => {
  jest.clearAllMocks();
  (supabase.from as jest.Mock).mockReturnValue(query);
  for (const method of ['select', 'eq', 'order', 'update', 'insert'] as const) query[method].mockReturnValue(query);
  query.single.mockResolvedValue({ data: { id: 'one' }, error: null });
});

test('reads beyond a single response page', async () => {
  const page = Array.from({ length: 500 }, (_, i) => ({ id: String(i) }));
  query.range.mockResolvedValueOnce({ data: page, error: null }).mockResolvedValueOnce({ data: [{ id: 'last' }], error: null });
  expect(await fetchItems('user')).toHaveLength(501);
  expect(query.range.mock.calls).toEqual([[0, 499], [500, 999]]);
  expect(query.eq).toHaveBeenCalledWith('user_id', 'user');
});

test('does not return a partial inbox when a later page fails', async () => {
  query.range.mockResolvedValueOnce({ data: Array(500).fill({ id: 'one' }), error: null }).mockResolvedValueOnce({ data: null, error: new Error('offline') });
  await expect(fetchItems('user')).rejects.toThrow('offline');
});

test('text edits preserve manually selected metadata', async () => {
  await updateItem('one', { content: ' A plain description ', priority: 'high', due_at: null });
  expect(query.update).toHaveBeenCalledWith({ content: 'A plain description', priority: 'high', due_at: null });
});

test('type changes clear incompatible fields', async () => {
  await updateItem('one', { type: 'note' });
  expect(query.update).toHaveBeenCalledWith({ type: 'note', account: null, direction: null, amount: null, priority: null, due_at: null, done: false });
});

test('empty captures and invalid amounts fail before reaching the backend', async () => {
  await expect(createItem('user', '  ')).rejects.toThrow('empty');
  await expect(updateItem('one', { amount: NaN })).rejects.toThrow('valid');
  await expect(updateItem('one', { content: '\n' })).rejects.toThrow('empty');
  expect(supabase.from).not.toHaveBeenCalled();
});

test('type picker can route writes through the shared state', async () => {
  const save = jest.fn().mockResolvedValue({ id: 'one', type: 'task' });
  await setItemType('one', 'task', { content: 'Need to finish slides', amount: null, account: null, direction: null, priority: 'high', due_at: null }, save);
  expect(save).toHaveBeenCalledWith('one', expect.objectContaining({ type: 'task', priority: 'high' }));
  expect(supabase.from).not.toHaveBeenCalled();
});
