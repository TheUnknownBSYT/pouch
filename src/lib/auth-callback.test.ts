import { createSessionFromUrl, parseAuthParams } from './auth-callback';
import { supabase } from './supabase';
jest.mock('./supabase', () => ({ supabase: { auth: { setSession: jest.fn(), exchangeCodeForSession: jest.fn() } } }));
beforeEach(() => jest.clearAllMocks());
test('query and hash parameters are both parsed', () => {
  expect(parseAuthParams('pouch://auth?source=email#access_token=a&refresh_token=b')).toEqual({ source: 'email', access_token: 'a', refresh_token: 'b' });
});
test('magic link establishes a session', async () => {
  (supabase.auth.setSession as jest.Mock).mockResolvedValue({ error: null });
  await expect(createSessionFromUrl('pouch://auth#access_token=a&refresh_token=b')).resolves.toBe(true);
  expect(supabase.auth.setSession).toHaveBeenCalledWith({ access_token: 'a', refresh_token: 'b' });
});
test('expired links surface an actionable error without setting a session', async () => {
  await expect(createSessionFromUrl('https://pouch.test/auth#error=access_denied&error_code=otp_expired')).rejects.toThrow('expired');
  expect(supabase.auth.setSession).not.toHaveBeenCalled();
});
test('ordinary links do not trigger authentication', async () => {
  await expect(createSessionFromUrl('pouch://item/123')).resolves.toBe(false);
  expect(supabase.auth.setSession).not.toHaveBeenCalled();
});
test('incomplete tokens are rejected', async () => {
  await expect(createSessionFromUrl('pouch://auth#access_token=a')).rejects.toThrow('incomplete');
});
test('authorization codes are exchanged and failures surface', async () => {
  (supabase.auth.exchangeCodeForSession as jest.Mock).mockResolvedValue({ error: new Error('invalid') });
  await expect(createSessionFromUrl('https://pouch.test/auth?code=abc')).rejects.toThrow('Request a new link');
});
