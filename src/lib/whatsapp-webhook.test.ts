/** @jest-environment node */
import { createHmac, webcrypto } from 'node:crypto';
import { createWhatsAppHandler } from '../../_support/supabase/functions/whatsapp-webhook/handler';
import { classifyWhatsApp, parseMessages } from '../../_support/supabase/functions/_shared/whatsapp';

Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
const config = { appSecret: 'test-secret', verifyToken: 'verify-only', phoneNumberId: 'business-1' };
const timestamp = String(Math.floor(Date.now() / 1000));
const message = (id: string, text = 'Paid ₹2000 for rent') => ({ id, from: '919876543210', timestamp, type: 'text', text: { body: text } });
const payload = (...messages: ReturnType<typeof message>[]) => ({ object: 'whatsapp_business_account', entry: [{ changes: [{ field: 'messages', value: { metadata: { phone_number_id: config.phoneNumberId }, messages } }] }] });
const backend = () => ({ pair: jest.fn().mockResolvedValue(undefined), timezone: jest.fn().mockResolvedValue('Asia/Kolkata'), capture: jest.fn().mockResolvedValue(undefined) });
const request = (value: unknown, secret = config.appSecret) => {
  const body = JSON.stringify(value);
  return new Request('https://pouch.test/webhook', { method: 'POST', body, headers: { 'x-hub-signature-256': `sha256=${createHmac('sha256', secret).update(body).digest('hex')}` } });
};

it('accepts the verification challenge only with the correct token', async () => {
  const handler = createWhatsAppHandler(config, backend());
  const query = '?hub.mode=subscribe&hub.verify_token=verify-only&hub.challenge=123';
  expect(await (await handler(new Request(`https://pouch.test/${query}`))).text()).toBe('123');
  expect((await handler(new Request(`https://pouch.test/${query.replace('verify-only', 'wrong')}`))).status).toBe(403);
});

it('rejects forged signatures before looking up any account', async () => {
  const db = backend();
  const handler = createWhatsAppHandler(config, db);
  expect((await handler(request(payload(message('one')), 'wrong-secret'))).status).toBe(401);
  expect(db.timezone).not.toHaveBeenCalled();
  expect(db.capture).not.toHaveBeenCalled();
});

it('processes all messages across all entries, not only the first one', async () => {
  const db = backend();
  const data = payload(message('one'), message('two', 'Call mom tomorrow'));
  data.entry.push(payload(message('three')).entry[0]);
  expect((await createWhatsAppHandler(config, db)(request(data))).status).toBe(200);
  expect(db.capture.mock.calls.map(([value]) => value.id)).toEqual(['one', 'two', 'three']);
  expect(db.capture.mock.calls[0][1]).toMatchObject({ type: 'expense', amount: 2000 });
});

it('pairs with a hash and never saves the connection token as a capture', async () => {
  const db = backend();
  const token = 'a'.repeat(32);
  await createWhatsAppHandler(config, db)(request(payload(message('one', `POUCH CONNECT ${token}`), message('two', 'POUCH CONNECT malformed'))));
  expect(db.pair).toHaveBeenCalledWith(expect.stringMatching(/^[a-f0-9]{64}$/), '919876543210');
  expect(db.pair.mock.calls[0][0]).not.toBe(token);
  expect(db.capture).not.toHaveBeenCalled();
});

it('ignores status events, other business numbers, and unpaired senders', async () => {
  const db = backend();
  db.timezone.mockResolvedValue(null);
  const handler = createWhatsAppHandler(config, db);
  await handler(request(payload(message('unpaired'))));
  const other = payload(message('other'));
  other.entry[0].changes[0].value.metadata.phone_number_id = 'another-business';
  await handler(request(other));
  await handler(request({ object: 'whatsapp_business_account', entry: [{ changes: [{ field: 'messages', value: { statuses: [] } }] }] }));
  expect(db.capture).not.toHaveBeenCalled();
  expect(db.timezone).toHaveBeenCalledTimes(1);
});

it('asks Meta to retry transient backend failures', async () => {
  const db = backend();
  db.capture.mockRejectedValue(new Error('database down'));
  expect((await createWhatsAppHandler(config, db)(request(payload(message('one'))))).status).toBe(503);
});

it('rejects oversized requests and malformed payloads safely', async () => {
  const handler = createWhatsAppHandler(config, backend());
  expect((await handler(new Request('https://pouch.test/', { method: 'POST', body: 'a'.repeat(1024 * 1024 + 1) }))).status).toBe(413);
  expect(parseMessages({ object: 'whatsapp_business_account', entry: [null, { changes: [null] }] }, config.phoneNumberId)).toEqual([]);
});

it('resolves tomorrow using the sender’s local date, including dates ahead of UTC', () => {
  expect(classifyWhatsApp('Call mom tomorrow', 'Asia/Kolkata', '2026-11-04T20:00:00Z').due_at).toBe('2026-11-06T06:30:00.000Z');
  expect(classifyWhatsApp('Call mom tomorrow', 'Pacific/Kiritimati', '2026-11-04T20:00:00Z').due_at).toBe('2026-11-05T22:00:00.000Z');
  expect(classifyWhatsApp('Call mom tomorrow', 'America/New_York', '2026-11-04T02:00:00Z').due_at).toBe('2026-11-04T17:00:00.000Z');
});
