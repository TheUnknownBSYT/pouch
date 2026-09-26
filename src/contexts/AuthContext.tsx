/**
 * AuthContext.tsx — login state for the whole app
 *
 * Flow: sendEmailCode → user enters 6-digit OTP → verifyEmailCode
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
  sendEmailCode: (email: string) => Promise<{ error: string | null }>;
  verifyEmailCode: (email: string, code: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastEmail, setLastEmail] = useState<string | null>(null);

  useEffect(() => {
    void getLastEmail().then(setLastEmail);
    return subscribeToAuthLinks();
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setLoading(false);
      if (nextSession?.user.email) {
        void saveLastEmail(nextSession.user.email);
        setLastEmail(nextSession.user.email);
      }
    });

    return () => {
      subscription.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      loading,
      lastEmail,
      sendEmailCode: async (email: string) => {
        const trimmed = email.trim().toLowerCase();
        const { error } = await supabase.auth.signInWithOtp({
          email: trimmed,
          options: {
            shouldCreateUser: true,
            emailRedirectTo:
              Platform.OS === 'web' && typeof window !== 'undefined'
                ? `${window.location.origin}/`
                : Linking.createURL('auth/callback'),
          },
        });

        if (!error) {
          await saveLastEmail(trimmed);
          setLastEmail(trimmed);
        }

        return { error: error?.message ?? null };
      },
      verifyEmailCode: async (email: string, code: string) => {
        const trimmed = email.trim().toLowerCase();
        const token = code.trim();

        const { error } = await supabase.auth.verifyOtp({
          email: trimmed,
          token,
          type: 'email',
        });

        if (!error) {
          await saveLastEmail(trimmed);
          setLastEmail(trimmed);
        }

        return { error: error?.message ?? null };
      },
      signOut: async () => {
        await supabase.auth.signOut();
      },
    }),
    [lastEmail, loading, session],
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
