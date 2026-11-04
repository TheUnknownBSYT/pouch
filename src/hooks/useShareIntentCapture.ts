import * as Haptics from 'expo-haptics';
import { useShareIntentContext } from 'expo-share-intent';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useAuth } from '@/contexts/AuthContext';
import { useItems } from '@/hooks/useItems';
import { inferShareSource, normalizeSharedContent } from '@/lib/shared-content';

export function useShareIntentCapture() {
  const { user } = useAuth();
  const { addItem } = useItems();
  // The provider owns the only native listener.
  const { hasShareIntent, shareIntent, resetShareIntent, error } = useShareIntentContext();
  const attemptedContent = useRef<string | null>(null);
  const latestShare = useRef(shareIntent);
  const saving = useRef(false);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    latestShare.current = shareIntent;
  }, [shareIntent]);

  const save = useCallback(async () => {
    if (!user || !hasShareIntent || saving.current) return;
    const content = normalizeSharedContent(shareIntent);
    if (!content) {
      setSaveError('Pouch can save shared text and links. Share a link to this file instead.');
      setStatus('error');
      return;
    }

    saving.current = true;
    setStatus('saving');
    setSaveError(null);
    try {
      await addItem(content, inferShareSource(content));
      // A second share may have arrived while the network request was in flight.
      if (normalizeSharedContent(latestShare.current) === content) resetShareIntent();
      setStatus('saved');
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch {
      // Keep native content intact when saving fails or the app backgrounds for login.
      setSaveError('Couldn’t save your share. Check your connection and try again.');
      setStatus('error');
    } finally {
      saving.current = false;
    }
  }, [addItem, hasShareIntent, resetShareIntent, shareIntent, user]);

  useEffect(() => {
    if (!hasShareIntent) {
      attemptedContent.current = null;
      return;
    }
    const content = normalizeSharedContent(shareIntent) ?? 'unsupported';
    if (!user || saving.current || attemptedContent.current === content) return;
    attemptedContent.current = content;
    void Promise.resolve().then(save);
  }, [hasShareIntent, save, shareIntent, status, user]);

  useEffect(() => {
    if (status !== 'saved') return;
    const timer = setTimeout(() => setStatus('idle'), 2500);
    return () => clearTimeout(timer);
  }, [status]);

  const dismiss = () => {
    resetShareIntent();
    setSaveError(null);
    setStatus('idle');
  };

  return {
    status,
    message: saveError ?? (error ? 'Couldn’t read that share. Please try sharing it again.' : null),
    waitingForSignIn: hasShareIntent && !user,
    retry: save,
    dismiss,
  };
}
