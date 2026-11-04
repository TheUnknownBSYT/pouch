import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

export type Palette = 'violet' | 'ocean' | 'forest' | 'sunset';
export interface PersonalSpace {
  display_name: string;
  invite_code: string;
  palette: Palette;
  compact: boolean;
  premium: boolean;
  qualified_invites: number;
  pending_invites: number;
  claimed_invite: boolean;
}
interface SpaceValue {
  space: PersonalSpace | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  update: (name: string, palette: Palette, compact: boolean) => Promise<void>;
  claimInvite: (code: string) => Promise<void>;
}
export const SpaceContext = createContext<SpaceValue | null>(null);

export function SpaceProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [space, setSpace] = useState<PersonalSpace | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const version = useRef(0);
  const active = useRef(true);
  const refresh = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    const requestVersion = ++version.current;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const { data, error: failure } = await supabase.rpc('get_my_space').abortSignal(controller.signal);
      if (failure) throw failure;
      if (active.current && version.current === requestVersion) { setSpace(data); setError(null); }
    } catch {
      if (active.current && version.current === requestVersion) setError('Personalization and invites are unavailable right now. Your inbox is ready to use.');
    } finally {
      clearTimeout(timeout);
      if (active.current) setLoading(false);
    }
  }, [user]);
  useEffect(() => {
    active.current = true;
    void Promise.resolve().then(refresh);
    const subscription = AppState.addEventListener('change', (state) => { if (state === 'active') void refresh(); });
    return () => { active.current = false; subscription.remove(); };
  }, [refresh]);
  const update = async (name: string, palette: Palette, compact: boolean) => {
    version.current += 1;
    const { data, error: failure } = await supabase.rpc('update_my_space', { p_name: name, p_palette: palette, p_compact: compact });
    if (failure) throw new Error(failure.message);
    if (active.current) { setSpace(data); setError(null); }
  };
  const claimInvite = async (code: string) => {
    version.current += 1;
    const { data, error: failure } = await supabase.rpc('claim_pouch_invite', { p_code: code.trim().toUpperCase() });
    if (failure) throw new Error(failure.message);
    if (active.current) setSpace(data);
  };
  return <SpaceContext.Provider value={{ space, loading, error, refresh, update, claimInvite }}>{children}</SpaceContext.Provider>;
}

export function useSpace() {
  const value = useContext(SpaceContext);
  if (!value) throw new Error('useSpace must be used within SpaceProvider');
  return value;
}
