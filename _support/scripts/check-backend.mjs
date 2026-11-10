/** Runs real PostgreSQL in memory. No credentials, network, or live project writes. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
let assertions = 0;
const check = (condition, description) => { assert.ok(condition, description); assertions += 1; };
const one = async (sql, params = []) => (await db.query(sql, params)).rows[0];
const expectFailure = async (action, description) => { await assert.rejects(action, description); assertions += 1; };
const rpc = async (name, args = [], placeholders = args.map((_, i) => `$${i + 1}`).join(',')) => {
  const row = await one(`select public.${name}(${placeholders}) as value`, args);
  return row.value;
};
async function asUser(id, action) {
  await db.exec('set role authenticated');
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [id]);
  try { return await action(); } finally { await db.exec('reset role'); }
}
async function asService(action) {
  await db.exec('set role service_role');
  try { return await action(); } finally { await db.exec('reset role'); }
}
const users = ['00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000005'];
try {
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth;
    create table auth.users(id uuid primary key, created_at timestamptz default now(), email_confirmed_at timestamptz);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid$$;
    grant usage on schema public, auth to authenticated, anon, service_role;
    grant execute on function auth.uid() to authenticated, anon, service_role;
  `);
  const base = await readFile(new URL('../supabase/migration.sql', import.meta.url), 'utf8');
  await db.exec(base.replace('ALTER PUBLICATION supabase_realtime ADD TABLE public.items;', ''));
  await db.exec('grant select, insert, update, delete on public.items to authenticated; grant all on public.items to service_role;');
  await db.exec(await readFile(new URL('../supabase/migrations/202611040001_space_and_whatsapp.sql', import.meta.url), 'utf8'));
  for (const [index, id] of users.entries()) {
    await db.query("insert into auth.users(id, created_at, email_confirmed_at) values($1, now() - interval '5 days' + $2 * interval '1 hour', now())", [id, index]);
  }
  const inviter = await asUser(users[0], () => rpc('get_my_space'));
  check(!inviter.premium && inviter.qualified_invites === 0, 'new profiles have no reward');
  await asUser(users[0], () => expectFailure(() => rpc('update_my_space', ['Alice', 'forest', false]), 'cannot self-grant a paid appearance'));
  await asUser(users[0], () => expectFailure(() => db.query('insert into public.entitlements(user_id, source) values($1, $2)', [users[0], 'gift']), 'clients cannot forge entitlements'));
  await asUser(users[0], () => expectFailure(() => rpc('claim_pouch_invite', [inviter.invite_code]), 'self referrals are rejected'));
  for (const id of users.slice(1, 4)) {
    await asUser(id, () => rpc('claim_pouch_invite', [inviter.invite_code]));
  }
  let progress = await asUser(users[0], () => rpc('get_my_space'));
  check(progress.qualified_invites === 0 && progress.pending_invites === 3, 'claimed codes alone earn no reward');
  await asUser(users[1], () => expectFailure(() => rpc('claim_pouch_invite', [inviter.invite_code]), 'one invite per friend'));
  await asUser(users[1], () => db.query("insert into public.items(user_id, content, type, source) values($1, 'web capture', 'note', 'web')", [users[1]]));
  progress = await asUser(users[0], () => rpc('get_my_space'));
  check(progress.qualified_invites === 0, 'web capture does not count as mobile activation');
  for (const id of users.slice(1, 4)) {
    await asUser(id, () => db.query("insert into public.items(user_id, content, type, source) values($1, 'mobile capture', 'note', 'manual')", [id]));
  }
  progress = await asUser(users[0], () => rpc('get_my_space'));
  check(progress.qualified_invites === 3 && progress.premium, 'third mobile activation grants lifetime Plus');
  await asUser(users[1], () => db.query("insert into public.items(user_id, content, type, source) values($1, 'another', 'note', 'manual')", [users[1]]));
  check((await asUser(users[0], () => rpc('get_my_space'))).qualified_invites === 3, 'repeat captures cannot multiply credit');
  const appearance = await asUser(users[0], () => rpc('update_my_space', ['Alice', 'forest', true]));
  check(appearance.palette === 'forest' && appearance.compact, 'earned Plus enables appearance settings');
  await asUser(users[4], () => expectFailure(() => db.query('select * from public.profiles'), 'another account cannot read private profiles'));
  await db.query('update auth.users set email_confirmed_at = null where id = $1', [users[4]]);
  await asUser(users[4], () => expectFailure(() => rpc('claim_pouch_invite', [inviter.invite_code]), 'unverified accounts cannot qualify'));
  await db.query("update auth.users set email_confirmed_at = now(), created_at = now() - interval '15 days' where id = $1", [users[4]]);
  await asUser(users[4], () => expectFailure(() => rpc('claim_pouch_invite', [inviter.invite_code]), 'old accounts cannot claim new-user rewards'));
  await db.query("update auth.users set created_at = now() - interval '1 day' where id = $1", [users[4]]);
  await asUser(users[4], () => db.query("insert into public.items(user_id, content, type, source) values($1, 'saved before invite', 'note', 'manual')", [users[4]]));
  await asUser(users[4], () => rpc('claim_pouch_invite', [inviter.invite_code]));
  check((await asUser(users[0], () => rpc('get_my_space'))).qualified_invites === 4, 'first capture before claiming also qualifies');

  const pairing = await asUser(users[0], () => rpc('begin_whatsapp_pairing', ['Asia/Kolkata']));
  check(/^[a-f0-9]{32}$/.test(pairing.token), 'pairing uses a high entropy token');
  const tokenHash = createHash('sha256').update(pairing.token).digest('hex');
  const stored = await one('select token_hash from public.whatsapp_pairing where user_id = $1', [users[0]]);
  check(stored.token_hash === tokenHash && stored.token_hash !== pairing.token, 'only the hash is stored');
  await asUser(users[0], () => expectFailure(() => rpc('begin_whatsapp_pairing', ['UTC']), 'pairing requests are throttled'));
  await asUser(users[0], () => expectFailure(() => rpc('complete_whatsapp_pairing', [tokenHash, '919876543210']), 'clients cannot bind their own sender ID'));
  check(await asService(() => rpc('complete_whatsapp_pairing', [tokenHash, '919876543210'])), 'verified worker can consume a pairing token');
  check(!await asService(() => rpc('complete_whatsapp_pairing', [tokenHash, '919876543210'])), 'pairing token is single-use');
  check((await asUser(users[0], () => rpc('get_my_whatsapp'))).suffix === '3210', 'client receives only masked phone details');
  const otherPair = await asUser(users[4], () => rpc('begin_whatsapp_pairing', ['UTC']));
  check(!await asService(() => rpc('complete_whatsapp_pairing', [createHash('sha256').update(otherPair.token).digest('hex'), '919876543210'])), 'phone cannot be stolen by another account');
  const expires = await asUser(users[4], () => rpc('begin_whatsapp_pairing', ['UTC']));
  await db.query("update public.whatsapp_pairing set expires_at = now() - interval '1 minute' where user_id = $1", [users[4]]);
  check(!await asService(() => rpc('complete_whatsapp_pairing', [createHash('sha256').update(expires.token).digest('hex'), '919999999999'])), 'expired codes cannot connect a phone');

  const captureArgs = ['919876543210', 'wamid.one', 'Paid ₹2000 for rent', JSON.stringify({ type: 'expense', amount: 2000, account: 'cash', direction: 'out' }), new Date().toISOString()];
  const capture = (args = captureArgs) => asService(() => rpc('capture_whatsapp_message', args));
  check(await capture(), 'linked sender inserts a capture');
  check(!await capture(), 'redelivery cannot duplicate a capture');
  const captured = await one("select * from public.items where user_id = $1 and source = 'whatsapp'", [users[0]]);
  check(Number(captured.amount) === 2000 && captured.content === captureArgs[2], 'classified message fields survive storage');
  await asUser(users[4], async () => check((await db.query('select id from public.items where id = $1', [captured.id])).rows.length === 0, 'items remain private across accounts'));
  await asUser(users[0], () => db.query('delete from public.items where id = $1', [captured.id]));
  check(!await capture(), 'retry cannot resurrect a user-deleted capture');
  check(!await capture(['919876543210', 'wamid.old', 'old message', '{"type":"note"}', '2020-01-01T00:00:00Z']), 'messages predating consent are ignored');
  check(!await capture(['919999999999', 'wamid.unknown', 'private', '{"type":"note"}', new Date().toISOString()]), 'unknown phone is never imported');
  await asUser(users[0], () => rpc('disconnect_my_whatsapp'));
  check(!(await asUser(users[0], () => rpc('get_my_whatsapp'))).connected, 'disconnect removes the mapping');
  check(!await capture(['919876543210', 'wamid.after', 'after disconnect', '{"type":"note"}', new Date().toISOString()]), 'disconnected sender cannot add captures');
  // Account deletion must also remove private routing data and reward metadata.
  await db.query('delete from auth.users where id = $1', [users[0]]);
  for (const table of ['items', 'profiles', 'entitlements', 'whatsapp_links', 'whatsapp_pairing', 'whatsapp_receipts']) {
    check(Number((await one(`select count(*) as total from public.${table} where user_id = $1`, [users[0]])).total) === 0, `${table} cascades on account deletion`);
  }
  check(Number((await one('select count(*) as total from public.referrals where inviter_id = $1 or invitee_id = $1', [users[0]])).total) === 0, 'referral relationships cascade on deletion');
  check(Number((await one('select count(*) as total from public.items where user_id = $1', [users[1]])).total) > 0, 'account deletion preserves another account’s captures');
  await asUser(users[0], () => expectFailure(() => rpc('get_my_space'), 'a stale JWT cannot recreate a deleted profile'));
  await asUser(users[0], () => expectFailure(() => db.query("insert into public.items(user_id, content, type) values($1, 'stale session', 'note')", [users[0]]), 'a stale JWT cannot recreate deleted account data'));
  console.log(`Backend integration: ${assertions} assertions passed.`);
} finally { await db.close(); }
