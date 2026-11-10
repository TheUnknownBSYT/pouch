import { createClient } from 'npm:@supabase/supabase-js@2.112.3';
import { createAccountDeletionHandler } from './handler.ts';

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

Deno.serve(createAccountDeletionHandler({
  async userId(token) {
    const { data, error } = await admin.auth.getUser(token);
    if (error && error.status && error.status >= 500) throw error;
    return error ? null : data.user?.id ?? null;
  },
  async revokeSessions(token) {
    const { error } = await admin.auth.admin.signOut(token, 'global');
    if (error) throw error;
  },
  async deleteUser(userId) {
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) throw error;
  },
}));
