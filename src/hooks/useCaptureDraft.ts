import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ItemType } from '@/types/item';

type Draft = { text: string; type?: ItemType };
const empty: Draft = { text: '' };

/** Writes are ordered, so a slow keystroke write cannot resurrect a sent draft. */
export function useCaptureDraft(userId?: string) {
  const key = `pouch:draft:v1:${userId ?? 'guest'}`;
  const [draft, setDraft] = useState<Draft>(empty);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const writes = useRef<Promise<unknown>>(Promise.resolve());
  const touched = useRef(false);
  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(key).then((raw) => {
      if (active && raw && !touched.current) {
        const value = JSON.parse(raw);
        if (typeof value?.text === 'string') setDraft({
          text: value.text,
          type: ['note', 'link', 'task', 'expense', 'contact', 'quote', 'unsorted'].includes(value.type) ? value.type : undefined,
        });
      }
    }).catch(() => {
      if (active) setError('Draft recovery is unavailable on this device.');
    }).finally(() => { if (active) setReady(true); });
    return () => { active = false; };
  }, [key]);

  const update = useCallback((next: Draft) => {
    touched.current = true;
    setDraft(next);
    writes.current = writes.current.catch(() => {}).then(() => AsyncStorage.setItem(key, JSON.stringify(next)))
      .catch(() => setError('Couldn’t back up your draft. Keep this screen open until you save it.'));
  }, [key]);
  return { draft, update, ready, error };
}
