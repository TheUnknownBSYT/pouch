import * as Linking from 'expo-linking';
import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';

export function parseAuthParams(url: string): Record<string, string> {
  const query = url.includes('?') ? url.split('?')[1].split('#')[0] : '';
  const hash = url.includes('#') ? url.split('#')[1] : '';
  return Object.fromEntries([...new URLSearchParams(query), ...new URLSearchParams(hash)]);
}
export async function createSessionFromUrl(url: string): Promise<boolean> {
  const params = parseAuthParams(url);
  if (params.error || params.error_code) throw new Error('This sign-in link has expired or is invalid. Request a new link below.');
  const accessToken = params.access_token;
  const refreshToken = params.refresh_token;
  if (!accessToken && !refreshToken && !params.code) return false;
  if (params.code) {
    const { error } = await supabase.auth.exchangeCodeForSession(params.code);
    if (error) throw new Error('Could not use this sign-in link. Request a new link on this device.');
  } else {
    if (!accessToken || !refreshToken) throw new Error('This sign-in link is incomplete. Request a new link below.');
    const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
    if (error) throw new Error('Could not sign in with this link. Request a new link below.');
  }
  return true;
}
export function subscribeToAuthLinks(onError: (message: string) => void = () => {}) {
  let active = true;
  let lastUrl: string | null = null;
  const handleUrl = async (url: string | null) => {
    if (!active || !url || url === lastUrl) return;
    lastUrl = url;
    try { await createSessionFromUrl(url); }
    catch (error) { if (active) onError(error instanceof Error ? error.message : 'Could not sign in. Request a new link.'); }
    finally {
      if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location.href === url) {
        const params = parseAuthParams(url);
        if (params.access_token || params.code || params.error || params.error_code) window.history.replaceState(null, '', window.location.pathname);
      }
    }
  };
  if (Platform.OS === 'web' && typeof window !== 'undefined') void handleUrl(window.location.href);
  else void Linking.getInitialURL().then(handleUrl).catch(() => onError('Could not open the sign-in link. Please try again.'));
  const subscription = Linking.addEventListener('url', event => { void handleUrl(event.url); });
  return () => { active = false; subscription.remove(); };
}
