import { createClient } from 'npm:@supabase/supabase-js@2.112.3';
const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers });
  const reply = (body: object, status = 200) => Response.json(body, { status, headers });
  if (req.method !== 'POST') return reply({ error: 'Method not allowed' }, 405);
  const token = req.headers.get('authorization')?.match(/^Bearer (.+)$/i)?.[1];
  if (!token) return reply({ error: 'Sign in first' }, 401);
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return reply({ error: 'Sign in again before deleting your account' }, 401);
  // Identity comes exclusively from a verified token, never from request parameters.
  const result = await admin.auth.admin.deleteUser(data.user.id);
  if (result.error) return reply({ error: 'Could not delete your account. Please retry.' }, 503);
  return reply({ deleted: true });
});
