import { useEffect, useRef } from 'react';
import { useShareIntent } from 'expo-share-intent';

import { useAuth } from '@/contexts/AuthContext';
import { useItems } from '@/hooks/useItems';
import type { ItemSource } from '@/types/item';

function mapShareSource(value?: string | null): ItemSource {
  const normalized = (value ?? '').toLowerCase();
  if (normalized.includes('instagram')) {
    return 'share-instagram';
  }
  if (normalized.includes('youtube')) {
    return 'share-youtube';
  }
  if (normalized.includes('whatsapp')) {
    return 'share-whatsapp';
  }
  return 'manual';
}

export function useShareIntentCapture() {
  const { user } = useAuth();
  const { addItem } = useItems();
  const { hasShareIntent, shareIntent, resetShareIntent, error } = useShareIntent();
  const handledKey = useRef<string | null>(null);

  useEffect(() => {
    if (!user || !hasShareIntent || !shareIntent) {
      return;
    }

    const payload = shareIntent.text ?? shareIntent.webUrl ?? shareIntent.files?.[0]?.path;
    if (!payload) {
      return;
    }

    const key = `${shareIntent.meta?.title ?? ''}:${payload}`;
    if (handledKey.current === key) {
      return;
    }

    handledKey.current = key;
    const source = mapShareSource(shareIntent.meta?.title);

    void addItem(String(payload), source)
      .catch((err) => {
        console.warn('Failed to save shared item', err);
      })
      .finally(() => {
        resetShareIntent();
      });
  }, [addItem, hasShareIntent, resetShareIntent, shareIntent, user]);

  useEffect(() => {
    if (error) {
      console.warn('Share intent error', error);
    }
  }, [error]);
}
