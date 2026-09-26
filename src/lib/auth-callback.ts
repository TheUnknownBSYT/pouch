import * as Linking from 'expo-linking';

import { supabase } from '@/lib/supabase';

function parseAuthParams(url: string): Record<string, string> {
  const params: Record<string, string> = {};
  const [, hashOrQuery = ''] = url.match(/[#?](.*)$/) ?? [];
  const search = new URLSearchParams(hashOrQuery);

  search.forEach((value, key) => {
    params[key] = value;
  });

  return params;
}

export async function createSessionFromUrl(url: string) {
  const params = parseAuthParams(url);
  const accessToken = params.access_token;
  const refreshToken = params.refresh_token;

  if (!accessToken || !refreshToken) {
    return;
  }

  const { error } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  if (error) {
    throw error;
  }
}

export function subscribeToAuthLinks() {
  const handleUrl = (url: string | null) => {
    if (!url) {
      return;
    }

    void createSessionFromUrl(url).catch((error) => {
      console.warn('Failed to complete auth from link', error);
    });
  };

  Linking.getInitialURL().then(handleUrl);

  const subscription = Linking.addEventListener('url', (event) => {
    handleUrl(event.url);
  });

  return () => {
    subscription.remove();
  };
}
