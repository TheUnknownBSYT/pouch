import { useCallback, useEffect, useRef, useState } from 'react';
import { useShareIntent } from 'expo-share-intent';

import { useAuth } from '@/contexts/AuthContext';
import { useItems } from '@/hooks/useItems';
import type { ItemSource } from '@/types/item';

function mapShareSource(value: string): ItemSource {
  const normalized = value.toLowerCase();
  if (normalized.includes('instagram')) return 'share-instagram';
  if (normalized.includes('youtube') || normalized.includes('youtu.be')) return 'share-youtube';
  if (normalized.includes('whatsapp')) return 'share-whatsapp';
  return 'manual';
}

export function useShareIntentCapture() {
  const { user } = useAuth();
  const { addItem } = useItems();
  const { hasShareIntent, shareIntent, resetShareIntent, error } = useShareIntent();
  const handledKey = useRef<string | null>(null);
  const inFlight = useRef(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const text = shareIntent?.text?.trim() ?? '';
  const url = shareIntent?.webUrl?.trim() ?? '';
  const payload = [text, url && !text.includes(url) ? url : ''].filter(Boolean).join('\n');
  const key = `${user?.id}:${shareIntent?.meta?.title ?? ''}:${payload}`;

  const capture = useCallback(async () => {
    if (!user || !hasShareIntent || inFlight.current) return;
    if (!payload) {
      setSaveError('Pouch currently saves shared text and links. Share a link instead of a file.');
      return;
    }
    inFlight.current = true;
    handledKey.current = key;
    setSaving(true);
    setSaveError(null);
    try {
      await addItem(payload, mapShareSource(`${shareIntent?.meta?.title ?? ''} ${url}`));
      resetShareIntent();
    } catch (err) {
      // Keep the intent available. Resetting on failure silently loses the share.
      setSaveError(err instanceof Error ? err.message : 'Could not save the shared item. Try again.');
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  }, [addItem, hasShareIntent, key, payload, resetShareIntent, shareIntent, url, user]);

  useEffect(() => {
    if (!hasShareIntent) {
      handledKey.current = null;
      return;
    }
    // An OS share event starts asynchronous persistence and its progress state.
    if (handledKey.current !== key) void capture();
  }, [capture, hasShareIntent, key]);

  return {
    error: hasShareIntent ? saveError ?? (error ? String(error) : null) : null,
    saving,
    retry: capture,
    dismiss: () => { setSaveError(null); resetShareIntent(); },
  };
}
