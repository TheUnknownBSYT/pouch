import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const LAST_EMAIL_KEY = 'pouch:last-email';

export async function getLastEmail(): Promise<string | null> {
  try {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      return window.localStorage.getItem(LAST_EMAIL_KEY);
    }
    return await AsyncStorage.getItem(LAST_EMAIL_KEY);
  } catch {
    return null;
  }
}

export async function saveLastEmail(email: string): Promise<void> {
  const trimmed = email.trim().toLowerCase();
  if (!trimmed) {
    return;
  }

  try {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.localStorage.setItem(LAST_EMAIL_KEY, trimmed);
      return;
    }
    await AsyncStorage.setItem(LAST_EMAIL_KEY, trimmed);
  } catch {
    // non-critical
  }
}
