import React, { useLayoutEffect } from 'react';
import { act, create } from 'react-test-renderer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SettingsProvider, useSettings, useColorScheme, parseSettings } from './SettingsContext';
jest.mock('@react-native-async-storage/async-storage', () => ({ getItem: jest.fn(), setItem: jest.fn() }));
let state: ReturnType<typeof useSettings>;
let scheme: string;
function Probe() { const value = useSettings(); const color = useColorScheme(); useLayoutEffect(() => { state = value; scheme = color; }, [value, color]); return null; }
test('corrupt and unknown preferences fall back safely', () => {
  expect(parseSettings('broken')).toEqual({ appearance: 'system', haptics: true, sort: 'newest' });
  expect(parseSettings('{"appearance":"purple","haptics":false,"sort":"oldest"}')).toEqual({ appearance: 'system', haptics: false, sort: 'oldest' });
});
test('restores preferences, applies explicit light mode, and persists changes', async () => {
  (AsyncStorage.getItem as jest.Mock).mockResolvedValue('{"appearance":"dark","haptics":false,"sort":"oldest"}');
  (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
  let tree!: ReturnType<typeof create>;
  await act(async () => { tree = create(React.createElement(SettingsProvider, null, React.createElement(Probe))); });
  expect(scheme).toBe('dark');
  expect(state.settings.haptics).toBe(false);
  await act(async () => state.updateSettings({ appearance: 'light' }));
  expect(scheme).toBe('light');
  expect(AsyncStorage.setItem).toHaveBeenLastCalledWith('pouch:settings:v1', JSON.stringify({ appearance: 'light', haptics: false, sort: 'oldest' }));
  await act(async () => tree.unmount());
});
