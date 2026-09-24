import { useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';

import { useAuth } from '@/contexts/AuthContext';

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) {
      return;
    }

    const onAuthScreen = segments[0] === 'auth';

    if (!session && !onAuthScreen) {
      router.replace('/auth');
      return;
    }

    if (session && onAuthScreen) {
      router.replace('/');
    }
  }, [loading, router, segments, session]);

  return children;
}
