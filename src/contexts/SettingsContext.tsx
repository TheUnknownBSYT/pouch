import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useColorScheme as useSystemColorScheme } from 'react-native';
import type { InboxSort } from '@/lib/inbox';

export interface Settings { appearance: 'system' | 'light' | 'dark'; haptics: boolean; sort: InboxSort }
export const defaultSettings: Settings = { appearance: 'system', haptics: true, sort: 'newest' };
const KEY = 'pouch:settings:v1';
export function parseSettings(raw: string | null): Settings {
  try {
    const value = JSON.parse(raw ?? '{}');
    return {
      appearance: ['system', 'light', 'dark'].includes(value?.appearance) ? value.appearance : 'system',
      haptics: typeof value?.haptics === 'boolean' ? value.haptics : true,
      sort: ['newest', 'oldest', 'priority'].includes(value?.sort) ? value.sort : 'newest',
    };
  } catch { return defaultSettings; }
}
const Context = createContext<{ settings: Settings; updateSettings: (patch: Partial<Settings>) => void; storageError: string | null } | null>(null);
export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState(defaultSettings);
  const [storageError, setStorageError] = useState<string | null>(null);
  const latest = useRef(defaultSettings);
  const touched = useRef<Partial<Settings>>({});
  const writes = useRef(Promise.resolve());
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(KEY).then(raw => {
      if (active) { latest.current = { ...parseSettings(raw), ...touched.current }; setSettings(latest.current); }
    }).catch(() => { if (active) setStorageError('Could not load saved settings.'); }).finally(() => { if (active) setReady(true); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (!ready) return;
    writes.current = writes.current.then(() => AsyncStorage.setItem(KEY, JSON.stringify(settings)))
      .then(() => setStorageError(null)).catch(() => setStorageError('Changes apply now, but could not be saved on this device.'));
  }, [ready, settings]);
  const updateSettings = useCallback((patch: Partial<Settings>) => {
    touched.current = { ...touched.current, ...patch };
    latest.current = { ...latest.current, ...patch };
    setSettings(latest.current);
  }, []);
  return <Context.Provider value={{ settings, updateSettings, storageError }}>{children}</Context.Provider>;
}
export function useSettings() {
  const value = useContext(Context);
  if (!value) throw new Error('SettingsProvider is required');
  return value;
}
export function useColorScheme() {
  const system = useSystemColorScheme();
  const { settings } = useSettings();
  return settings.appearance === 'system' ? (system === 'dark' ? 'dark' : 'light') : settings.appearance;
}
