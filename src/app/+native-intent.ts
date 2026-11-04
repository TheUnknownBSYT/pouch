/** The share extension's callback is transport data, not an Expo Router screen. */
export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  try {
    const url = new URL(path, 'pouch://');
    if (url.hostname.toLowerCase().startsWith('dataurl=')) return '/';
    if (url.hostname === 'auth' && url.pathname === '/callback') return '/auth';
    if (url.pathname === '/auth/callback') return '/auth';
    return path;
  } catch {
    return '/';
  }
}
