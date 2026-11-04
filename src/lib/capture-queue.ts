import type { Item } from '../types/item';

interface Storage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<unknown>;
}

/** Per-account, durable outbox. Disk mutations serialize; network never blocks capture. */
export class CaptureQueue {
  private rows: Item[] = [];
  private ready: Promise<void>;
  private writes: Promise<unknown> = Promise.resolve();
  private flushing: Promise<void> | null = null;
  private key: string;

  constructor(private userId: string, private storage: Storage) {
    this.key = `pouch:outbox:v1:${userId}`;
    this.ready = storage.getItem(this.key).then((raw) => {
      if (!raw) return;
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed) || parsed.some((row) => !row || row.user_id !== userId || typeof row.id !== 'string' || typeof row.content !== 'string')) {
        throw new Error('Could not read your saved captures. Please keep this app installed and try again.');
      }
      this.rows = parsed;
    });
    // The caller receives the original rejection through list/enqueue/flush.
    void this.ready.catch(() => {});
  }

  async list(): Promise<Item[]> {
    await this.ready;
    await this.writes;
    return [...this.rows];
  }

  private mutate(change: (rows: Item[]) => Item[]) {
    const write = this.writes.then(async () => {
      await this.ready;
      const next = change(this.rows);
      await this.storage.setItem(this.key, JSON.stringify(next));
      this.rows = next;
    });
    this.writes = write.catch(() => {});
    return write;
  }

  enqueue(item: Item): Promise<void> {
    if (item.user_id !== this.userId) return Promise.reject(new Error('Capture account mismatch.'));
    return this.mutate((rows) => [...rows.filter((row) => row.id !== item.id), item]);
  }

  flush(send: (item: Item) => Promise<Item>, onSaved: (item: Item) => void, active = () => true): Promise<void> {
    if (this.flushing) return this.flushing;
    this.flushing = (async () => {
      while (active()) {
        const [next] = await this.list();
        if (!next) return;
        const saved = await send(next);
        // A lost acknowledgement is safe: send uses the same UUID on every retry.
        await this.mutate((rows) => rows.filter((row) => row.id !== next.id));
        onSaved(saved);
      }
    })().finally(() => { this.flushing = null; });
    return this.flushing;
  }
}
