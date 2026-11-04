import { createClient } from 'npm:@supabase/supabase-js@2.112.3';
import { createWhatsAppHandler } from './handler.ts';

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

Deno.serve(createWhatsAppHandler({
  appSecret: Deno.env.get('WHATSAPP_APP_SECRET') ?? '',
  verifyToken: Deno.env.get('WHATSAPP_VERIFY_TOKEN') ?? '',
  phoneNumberId: Deno.env.get('WHATSAPP_PHONE_NUMBER_ID') ?? '',
}, {
  async pair(tokenHash, sender) {
    const { error } = await db.rpc('complete_whatsapp_pairing', { p_token_hash: tokenHash, p_sender: sender });
    if (error) throw error;
  },
  async timezone(sender) {
    const { data, error } = await db.from('whatsapp_links').select('timezone').eq('sender_id', sender).maybeSingle();
    if (error) throw error;
    return data?.timezone ?? null;
  },
  async capture(message, classified) {
    const { error } = await db.rpc('capture_whatsapp_message', {
      p_sender: message.sender, p_message_id: message.id, p_content: message.content,
      p_classified: classified, p_occurred_at: message.timestamp,
    });
    if (error) throw error;
  },
}));
