/**
 * AuthContext.tsx — login state for the whole app
 *
 * Flow: request a sign-in link → open email link → session persists.
 * Session persists via Supabase + AsyncStorage (see lib/supabase.ts).
 */
import type { Session, User } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';

import { getLastEmail, saveLastEmail } from '@/lib/auth-storage';
import { subscribeToAuthLinks } from '@/lib/auth-callback';
import { supabase } from '@/lib/supabase';

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  loading: boolean;
  lastEmail: string | null;
  sendSignInLink: (email: string) => Promise<{ error: string | null }>;
  authError: string | null;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [authError, setAuthError] = useState<string | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastEmail, setLastEmail] = useState<string | null>(null);

  useEffect(() => {
    void getLastEmail().then(setLastEmail).catch(() => setLastEmail(null));
    return subscribeToAuthLinks(setAuthError);
  }, []);

  useEffect(() => {
    let active = true;
    let authEventReceived = false;
    supabase.auth.getSession().then(({ data }) => {
      if (!active || authEventReceived) return;
      setSession(data.session);
      setLoading(false);
    }).catch(() => {
      if (active && !authEventReceived) setLoading(false);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      authEventReceived = true;
      if (!active) return;
      setSession(nextSession);
      setLoading(false);
      if (nextSession?.user.email) {
        void saveLastEmail(nextSession.user.email).catch(() => undefined);
        setLastEmail(nextSession.user.email);
      }
    });

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      loading,
      lastEmail,
      authError,
      sendSignInLink: async (email: string) => {
        setAuthError(null);
        const trimmed = email.trim().toLowerCase();
        const { error } = await supabase.auth.signInWithOtp({
          email: trimmed,
          options: {
            shouldCreateUser: true,
            emailRedirectTo:
              Platform.OS === 'web' && typeof window !== 'undefined'
                ? `${window.location.origin}/`
                : Linking.createURL('auth'),
          },
        });

        if (!error) {
          await saveLastEmail(trimmed);
          setLastEmail(trimmed);
        }

        return { error: error?.message ?? null };
      },
      signOut: async () => {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
      },
    }),
    [authError, lastEmail, loading, session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
