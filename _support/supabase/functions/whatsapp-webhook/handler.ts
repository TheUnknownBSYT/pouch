import { classifyWhatsApp, hashToken, parseMessages, verifySignature } from '../_shared/whatsapp.ts';

export interface WhatsAppBackend {
  pair(tokenHash: string, sender: string): Promise<void>;
  timezone(sender: string): Promise<string | null>;
  capture(message: { sender: string; id: string; content: string; timestamp: string }, classified: ReturnType<typeof classifyWhatsApp>): Promise<void>;
}

export function createWhatsAppHandler(config: { appSecret: string; verifyToken: string; phoneNumberId: string }, backend: WhatsAppBackend) {
  return async (request: Request): Promise<Response> => {
    const url = new URL(request.url);
    if (!config.appSecret || !config.verifyToken || !config.phoneNumberId) return new Response('Not configured', { status: 503 });
    if (request.method === 'GET') {
      const challenge = url.searchParams.get('hub.challenge');
      if (url.searchParams.get('hub.mode') === 'subscribe' && url.searchParams.get('hub.verify_token') === config.verifyToken && challenge && challenge.length < 512) {
        return new Response(challenge, { headers: { 'Content-Type': 'text/plain' } });
      }
      return new Response('Forbidden', { status: 403 });
    }
    if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });
    if (!request.body) return new Response('Missing payload', { status: 400 });
    const reader = request.body.getReader();
    const chunks: Uint8Array[] = [];
    let length = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > 1024 * 1024) { await reader.cancel(); return new Response('Payload too large', { status: 413 }); }
      chunks.push(value);
    }
    const body = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.length; }
    if (!await verifySignature(body, request.headers.get('x-hub-signature-256'), config.appSecret)) {
      return new Response('Invalid signature', { status: 401 });
    }
    let payload: unknown;
    try { payload = JSON.parse(new TextDecoder().decode(body)); }
    catch { return new Response('Invalid JSON', { status: 400 }); }
    try {
      // Process every entry/change/message in a webhook batch. SQL handles redelivery atomically.
      for (const message of parseMessages(payload, config.phoneNumberId)) {
        const pairing = message.content.match(/^POUCH CONNECT ([a-f0-9]{32})$/i);
        if (pairing) {
          await backend.pair(await hashToken(pairing[1].toLowerCase()), message.sender);
          continue;
        }
        // Never put malformed/expired connection commands into someone's inbox.
        if (/^POUCH CONNECT\b/i.test(message.content)) continue;
        const timezone = await backend.timezone(message.sender);
        if (!timezone) continue;
        await backend.capture(message, classifyWhatsApp(message.content, timezone, message.timestamp));
      }
    } catch {
      // Non-2xx asks Meta to retry. Never log users' message bodies or pairing tokens.
      return new Response('Please retry', { status: 503 });
    }
    return new Response('OK');
  };
}
