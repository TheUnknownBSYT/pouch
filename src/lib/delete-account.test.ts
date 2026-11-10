/** @jest-environment node */
import { createAccountDeletionHandler } from '../../_support/supabase/functions/delete-account/handler';

const backend = () => ({
  userId: jest.fn().mockResolvedValue('verified-user'),
  revokeSessions: jest.fn().mockResolvedValue(undefined),
  deleteUser: jest.fn().mockResolvedValue(undefined),
});
const request = (token = 'valid-token', method = 'POST') => new Request('https://pouch.test/delete-account', {
  method, headers: token ? { authorization: `Bearer ${token}` } : {},
  ...(method === 'POST' ? { body: JSON.stringify({ user_id: 'someone-else' }) } : {}),
});

it('rejects missing or invalid credentials without deleting anyone', async () => {
  const db = backend();
  const handler = createAccountDeletionHandler(db);
  expect((await handler(request(''))).status).toBe(401);
  expect(db.userId).not.toHaveBeenCalled();
  db.userId.mockResolvedValue(null);
  expect((await handler(request('bad-token'))).status).toBe(401);
  expect(db.revokeSessions).not.toHaveBeenCalled();
  expect(db.deleteUser).not.toHaveBeenCalled();
});

it('revokes sessions before deleting only the verified account', async () => {
  const db = backend();
  const response = await createAccountDeletionHandler(db)(request());
  expect(await response.json()).toEqual({ deleted: true });
  expect(db.revokeSessions).toHaveBeenCalledWith('valid-token');
  expect(db.deleteUser).toHaveBeenCalledWith('verified-user');
  expect(db.revokeSessions.mock.invocationCallOrder[0]).toBeLessThan(db.deleteUser.mock.invocationCallOrder[0]);
});

it('does not delete when session revocation fails', async () => {
  const db = backend();
  db.revokeSessions.mockRejectedValue(new Error('private service details'));
  const response = await createAccountDeletionHandler(db)(request());
  expect(response.status).toBe(503);
  expect(await response.text()).not.toContain('private service details');
  expect(db.deleteUser).not.toHaveBeenCalled();
});

it('does not report success when Auth or deletion is unavailable', async () => {
  for (const failingMethod of ['userId', 'deleteUser'] as const) {
    const db = backend();
    db[failingMethod].mockRejectedValue(new Error('unavailable'));
    expect((await createAccountDeletionHandler(db)(request())).status).toBe(503);
  }
});

it('allows preflight but rejects non-POST deletion', async () => {
  const db = backend();
  const handler = createAccountDeletionHandler(db);
  expect((await handler(request('', 'OPTIONS'))).status).toBe(200);
  expect((await handler(request('valid-token', 'GET'))).status).toBe(405);
  expect(db.userId).not.toHaveBeenCalled();
});
