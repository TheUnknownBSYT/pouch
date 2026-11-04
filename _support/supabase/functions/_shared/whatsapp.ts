import { classifyItem } from '../../../../src/lib/classifyItem.ts';

export type WhatsAppMessage = { id: string; sender: string; content: string; timestamp: string };
const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' ? value as Record<string, unknown> : {};
const array = (value: unknown): unknown[] => Array.isArray(value) ? value : [];

export function parseMessages(payload: unknown, phoneNumberId: string): WhatsAppMessage[] {
  const root = record(payload);
  if (root.object !== 'whatsapp_business_account') return [];
  const result: WhatsAppMessage[] = [];
  for (const entry of array(root.entry)) {
    for (const change of array(record(entry).changes)) {
      if (record(change).field !== 'messages') continue;
      const value = record(record(change).value);
      if (record(value.metadata).phone_number_id !== phoneNumberId) continue;
      for (const raw of array(value.messages)) {
        const message = record(raw);
        if (message.type !== 'text') continue;
        const content = record(message.text).body;
        const timestamp = typeof message.timestamp === 'string' ? Number(message.timestamp) * 1000 : NaN;
        if (typeof message.id !== 'string' || !message.id || message.id.length > 512 ||
          typeof message.from !== 'string' || !/^\d{7,20}$/.test(message.from) ||
          typeof content !== 'string' || !content.trim() || content.length > 20000 ||
          !Number.isFinite(timestamp) || timestamp <= 0 || timestamp > Date.now() + 300000) continue;
        result.push({ id: message.id, sender: message.from, content: content.trim(), timestamp: new Date(timestamp).toISOString() });
      }
    }
  }
  return result;
}

export async function verifySignature(body: Uint8Array, signature: string | null, secret: string): Promise<boolean> {
  if (!secret || !signature || !/^sha256=[a-f0-9]{64}$/i.test(signature)) return false;
  const bytes = Uint8Array.from(signature.slice(7).match(/../g)!, (part) => parseInt(part, 16));
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
  return crypto.subtle.verify('HMAC', key, bytes, body as Uint8Array<ArrayBuffer>);
}

export async function hashToken(token: string): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** Evaluate calendar hints in the linked person's timezone, not the server's UTC day. */
export function classifyWhatsApp(content: string, timezone: string, receivedAt: string) {
  const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' });
  const parts = formatter.formatToParts(new Date(receivedAt));
  const part = (type: string) => parts.find((value) => value.type === type)!.value;
  // Give the calendar parser the sender's date in the runtime's local calendar.
  // This works in UTC Edge Functions and non-UTC development/test environments.
  const localDay = new Date(Number(part('year')), Number(part('month')) - 1, Number(part('day')), 12);
  const result = classifyItem(content, localDay);
  if (result.due_at) {
    const due = new Date(result.due_at);
    const desired = new Date(Date.UTC(due.getFullYear(), due.getMonth(), due.getDate(), 12));
    const localParts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
    }).formatToParts(desired);
    const n = (type: string) => Number(localParts.find((value) => value.type === type)!.value);
    const represented = Date.UTC(n('year'), n('month') - 1, n('day'), n('hour'), n('minute'), n('second'));
    result.due_at = new Date(desired.getTime() * 2 - represented).toISOString();
  }
  return result;
}
