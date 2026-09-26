import React, { useLayoutEffect } from 'react';
import { act, create } from 'react-test-renderer';
import { ItemsProvider, useItems } from './ItemsContext';
import { createItem, deleteItem, fetchItems, subscribeToItems, updateItem } from '@/lib/items';
import type { Item } from '@/types/item';

jest.mock('./AuthContext', () => {
  const auth = { user: { id: 'user' } };
  return { useAuth: () => auth };
});
jest.mock('@/lib/items', () => ({ createItem: jest.fn(), deleteItem: jest.fn(), fetchItems: jest.fn(), subscribeToItems: jest.fn(), updateItem: jest.fn() }));

const row: Item = { id: 'one', user_id: 'user', content: 'Read notes', type: 'task', amount: null, source: 'web', done: false, occurred_at: '2026-09-25T12:00:00Z', account: null, direction: null, priority: 'low', due_at: null, created_at: '2026-09-25T12:00:00Z' };
let state: ReturnType<typeof useItems>;
let tree: ReturnType<typeof create>;
function Probe() {
  const value = useItems();
  useLayoutEffect(() => { state = value; }, [value]);
  return null;
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

beforeEach(async () => {
  jest.clearAllMocks();
  (fetchItems as jest.Mock).mockResolvedValue([row]);
  (subscribeToItems as jest.Mock).mockReturnValue(() => {});
  await act(async () => { tree = create(React.createElement(ItemsProvider, null, React.createElement(Probe))); });
});
afterEach(async () => { await act(async () => tree.unmount()); });

test('late refresh cannot overwrite a newer refresh', async () => {
  const slow = deferred<Item[]>();
  (fetchItems as jest.Mock).mockReturnValueOnce(slow.promise).mockResolvedValueOnce([{ ...row, content: 'Latest' }]);
  let first!: Promise<void>;
  await act(async () => { first = state.refresh(); await state.refresh(); });
  await act(async () => { slow.resolve([row]); await first; });
  expect(state.items[0].content).toBe('Latest');
});

test('failed delete restores its item even when reload also fails', async () => {
  (deleteItem as jest.Mock).mockRejectedValue(new Error('offline'));
  (fetchItems as jest.Mock).mockRejectedValue(new Error('offline'));
  await act(async () => { await expect(state.removeItem(row.id)).rejects.toThrow('offline'); });
  expect(state.items.map(item => item.id)).toEqual(['one']);
});

test('rapid duplicate captures create only one backend request', async () => {
  const save = deferred<Item>();
  (createItem as jest.Mock).mockReturnValue(save.promise);
  let first!: Promise<Item>;
  await act(async () => {
    first = state.addItem('same');
    await expect(state.addItem('same')).rejects.toThrow('already being saved');
  });
  expect(createItem).toHaveBeenCalledTimes(1);
  await act(async () => { save.resolve(row); await first; });
});

test('task toggle rolls back when the write fails', async () => {
  (updateItem as jest.Mock).mockRejectedValue(new Error('offline'));
  (fetchItems as jest.Mock).mockRejectedValue(new Error('offline'));
  await act(async () => { await expect(state.toggleTaskDone(row)).rejects.toThrow('offline'); });
  expect(state.items[0].done).toBe(false);
});
