import { CaptureQueue } from './capture-queue';
import { buildCapture, classifyCapture } from './capture';

function storage() {
  const entries = new Map<string, string>();
  return {
    getItem: jest.fn(async (key: string) => entries.get(key) ?? null),
    setItem: jest.fn(async (key: string, value: string) => { entries.set(key, value); }),
  };
}
const item = (id: string, user = 'alice') => buildCapture(user, id, 'Call mom tomorrow', 'manual');

it('recovers captures after restart and keeps different accounts isolated', async () => {
  const disk = storage();
  await new CaptureQueue('alice', disk).enqueue(item('one'));
  expect(await new CaptureQueue('alice', disk).list()).toHaveLength(1);
  expect(await new CaptureQueue('bob', disk).list()).toEqual([]);
  await expect(new CaptureQueue('bob', disk).enqueue(item('two'))).rejects.toThrow('mismatch');
});

it('does not acknowledge a capture when durable storage fails', async () => {
  const disk = storage();
  disk.setItem.mockRejectedValueOnce(new Error('Disk full'));
  const queue = new CaptureQueue('alice', disk);
  await expect(queue.enqueue(item('one'))).rejects.toThrow('Disk full');
  expect(await queue.list()).toEqual([]);
  await queue.enqueue(item('two'));
  expect((await queue.list()).map((row) => row.id)).toEqual(['two']);
});

it('keeps failed uploads for retry with exactly the same item ID', async () => {
  const queue = new CaptureQueue('alice', storage());
  const captured = item('one');
  await queue.enqueue(captured);
  const upload = jest.fn().mockRejectedValueOnce(new Error('Offline')).mockResolvedValue(captured);
  await expect(queue.flush(upload, jest.fn())).rejects.toThrow('Offline');
  expect(await queue.list()).toEqual([captured]);
  await queue.flush(upload, jest.fn());
  expect(upload.mock.calls.map(([row]) => row.id)).toEqual(['one', 'one']);
  expect(await queue.list()).toEqual([]);
});

it('allows capture during an in-flight upload without losing either item', async () => {
  const queue = new CaptureQueue('alice', storage());
  await queue.enqueue(item('one'));
  let finish!: (row: ReturnType<typeof item>) => void;
  let started!: () => void;
  const sending = new Promise<void>((resolve) => { started = resolve; });
  const upload = jest.fn().mockImplementationOnce(() => { started(); return new Promise((resolve) => { finish = resolve; }); }).mockImplementation(async (row) => row);
  const first = queue.flush(upload, jest.fn());
  await sending;
  await queue.enqueue(item('two'));
  expect((await queue.list()).map((row) => row.id)).toEqual(['one', 'two']);
  const second = queue.flush(upload, jest.fn());
  expect(second).toBe(first);
  finish(item('one'));
  await first;
  expect(upload).toHaveBeenCalledTimes(2);
  expect(await queue.list()).toEqual([]);
});

it('preserves malformed storage instead of silently replacing it', async () => {
  const disk = storage();
  disk.getItem.mockResolvedValueOnce('broken');
  const queue = new CaptureQueue('alice', disk);
  await expect(queue.enqueue(item('one'))).rejects.toThrow();
  expect(disk.setItem).not.toHaveBeenCalled();
});

it('stops sending remaining captures when the account is no longer active', async () => {
  const queue = new CaptureQueue('alice', storage());
  await queue.enqueue(item('one')); await queue.enqueue(item('two'));
  let active = true;
  await queue.flush(async (row) => { active = false; return row; }, jest.fn(), () => active);
  expect((await queue.list()).map((row) => row.id)).toEqual(['two']);
});

it('clears metadata when the person corrects a classification', () => {
  expect(classifyCapture('Paid ₹500 cash', 'note')).toEqual({ type: 'note', amount: null });
  expect(classifyCapture('Paid ₹500 cash', 'task')).toMatchObject({ type: 'task', amount: null, priority: 'low' });
  expect(() => buildCapture('alice', 'one', ' ', 'manual')).toThrow();
  expect(() => buildCapture('alice', 'one', 'a'.repeat(20001), 'manual')).toThrow();
});
