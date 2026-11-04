-- Apply after the existing v1-v3 migrations. No existing items are changed.
begin;

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 40),
  invite_code text not null unique default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)),
  palette text not null default 'violet' check (palette in ('violet', 'ocean', 'forest', 'sunset')),
  compact boolean not null default false,
  created_at timestamptz not null default now()
);
create table public.entitlements (
  user_id uuid primary key references auth.users(id) on delete cascade,
  source text not null check (source in ('referral', 'purchase', 'gift')),
  granted_at timestamptz not null default now()
);
create table public.referrals (
  invitee_id uuid primary key references auth.users(id) on delete cascade,
  inviter_id uuid not null references public.profiles(user_id) on delete cascade,
  claimed_at timestamptz not null default now(),
  qualified_at timestamptz,
  check (invitee_id <> inviter_id)
);
create index referrals_inviter_idx on public.referrals(inviter_id);

create table public.whatsapp_links (
  user_id uuid primary key references auth.users(id) on delete cascade,
  sender_id text not null unique,
  timezone text not null default 'UTC',
  connected_at timestamptz not null default now()
);
create table public.whatsapp_pairing (
  user_id uuid primary key references auth.users(id) on delete cascade,
  token_hash text not null unique,
  timezone text not null default 'UTC',
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
-- Separate receipt ledger: deleting a capture must not let a webhook retry recreate it.
create table public.whatsapp_receipts (
  message_id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  received_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.entitlements enable row level security;
alter table public.referrals enable row level security;
alter table public.whatsapp_links enable row level security;
alter table public.whatsapp_pairing enable row level security;
alter table public.whatsapp_receipts enable row level security;
-- All client access goes through narrowly scoped RPCs. No client-writable rewards.
revoke all on public.profiles, public.entitlements, public.referrals,
  public.whatsapp_links, public.whatsapp_pairing, public.whatsapp_receipts from anon, authenticated;
grant all on public.profiles, public.entitlements, public.referrals,
  public.whatsapp_links, public.whatsapp_pairing, public.whatsapp_receipts to service_role;

create function public.get_my_space() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); result jsonb;
begin
  if me is null then raise exception 'Sign in first'; end if;
  insert into public.profiles(user_id) values(me) on conflict do nothing;
  select jsonb_build_object(
    'display_name', p.display_name, 'invite_code', p.invite_code,
    'palette', p.palette, 'compact', p.compact,
    'premium', exists(select 1 from public.entitlements e where e.user_id = me),
    'qualified_invites', (select count(*) from public.referrals r where r.inviter_id = me and r.qualified_at is not null),
    'pending_invites', (select count(*) from public.referrals r where r.inviter_id = me and r.qualified_at is null),
    'claimed_invite', exists(select 1 from public.referrals r where r.invitee_id = me)
  ) into result from public.profiles p where p.user_id = me;
  return result;
end;
$$;

create function public.update_my_space(p_name text, p_palette text, p_compact boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid();
begin
  perform public.get_my_space();
  if char_length(trim(p_name)) > 40 or p_name is null then raise exception 'Use a name under 40 characters'; end if;
  if p_palette is null or p_palette not in ('violet', 'ocean', 'forest', 'sunset') or p_compact is null then raise exception 'Invalid appearance'; end if;
  if (p_palette <> 'violet' or p_compact) and not exists(select 1 from public.entitlements where user_id = me) then
    raise exception 'This appearance is part of Pouch Plus';
  end if;
  update public.profiles set display_name = trim(p_name), palette = p_palette, compact = p_compact where user_id = me;
  return public.get_my_space();
end;
$$;

create function public.qualify_pouch_referral(p_invitee uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare inviter uuid;
begin
  select inviter_id into inviter from public.referrals where invitee_id = p_invitee and qualified_at is null;
  if inviter is null then return; end if;
  -- A confirmed account and a capture from the mobile app qualify; sharing alone never does.
  if not exists(select 1 from auth.users where id = p_invitee and email_confirmed_at is not null)
    or not exists(select 1 from public.items where user_id = p_invitee and (source = 'manual' or source like 'share%')) then return; end if;
  -- Serialize qualification for one inviter so simultaneous friends cannot miss the threshold.
  perform 1 from public.profiles where user_id = inviter for update;
  update public.referrals set qualified_at = now() where invitee_id = p_invitee and qualified_at is null;
  if (select count(*) from public.referrals where inviter_id = inviter and qualified_at is not null) >= 3 then
    insert into public.entitlements(user_id, source) values(inviter, 'referral') on conflict do nothing;
  end if;
end;
$$;

create function public.claim_pouch_invite(p_code text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); inviter uuid; joined timestamptz;
begin
  if me is null then raise exception 'Sign in first'; end if;
  select created_at into joined from auth.users where id = me and email_confirmed_at is not null for update;
  if joined is null then raise exception 'Verify your email before using an invite'; end if;
  if joined < now() - interval '14 days' then raise exception 'Invite codes can be added in your first 14 days'; end if;
  if exists(select 1 from public.referrals where invitee_id = me) then raise exception 'You have already used an invite'; end if;
  select p.user_id into inviter from public.profiles p join auth.users u on u.id = p.user_id
    where p.invite_code = upper(trim(p_code)) and u.created_at < joined;
  if inviter is null or inviter = me then raise exception 'That invite code cannot be used'; end if;
  insert into public.referrals(invitee_id, inviter_id) values(me, inviter);
  perform public.qualify_pouch_referral(me);
  return public.get_my_space();
end;
$$;

create function public.on_pouch_capture_referral() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform public.qualify_pouch_referral(new.user_id);
  return new;
end;
$$;
create trigger pouch_capture_referral after insert on public.items
for each row execute function public.on_pouch_capture_referral();

create function public.get_my_whatsapp() returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  return coalesce((select jsonb_build_object('connected', true, 'suffix', right(sender_id, 4), 'connected_at', connected_at)
    from public.whatsapp_links where user_id = auth.uid()), '{"connected": false}'::jsonb);
end;
$$;

create function public.begin_whatsapp_pairing(p_timezone text default 'UTC') returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); token text := replace(gen_random_uuid()::text, '-', ''); expires timestamptz := now() + interval '10 minutes';
begin
  if me is null then raise exception 'Sign in first'; end if;
  perform 1 from auth.users where id = me for update;
  if exists(select 1 from public.whatsapp_links where user_id = me) then raise exception 'Disconnect your current WhatsApp first'; end if;
  if not exists(select 1 from pg_timezone_names where name = p_timezone) then raise exception 'Invalid timezone'; end if;
  if exists(select 1 from public.whatsapp_pairing where user_id = me and created_at > now() - interval '30 seconds') then
    raise exception 'Wait 30 seconds before creating another connection link';
  end if;
  insert into public.whatsapp_pairing(user_id, token_hash, timezone, expires_at)
    values(me, encode(sha256(convert_to(token, 'UTF8')), 'hex'), p_timezone, expires)
    on conflict(user_id) do update set token_hash = excluded.token_hash, timezone = excluded.timezone, expires_at = excluded.expires_at, created_at = now();
  return jsonb_build_object('token', token, 'expires_at', expires);
end;
$$;

create function public.disconnect_my_whatsapp() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  delete from public.whatsapp_pairing where user_id = auth.uid();
  delete from public.whatsapp_links where user_id = auth.uid();
end;
$$;

-- Only the signed webhook worker may call these two functions.
create function public.complete_whatsapp_pairing(p_token_hash text, p_sender text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare pairing public.whatsapp_pairing; linked uuid;
begin
  if p_sender !~ '^[0-9]{7,20}$' then return false; end if;
  delete from public.whatsapp_pairing where token_hash = p_token_hash and expires_at > now() returning * into pairing;
  if pairing.user_id is null then return false; end if;
  insert into public.whatsapp_links(user_id, sender_id, timezone) values(pairing.user_id, p_sender, pairing.timezone)
    on conflict do nothing returning user_id into linked;
  return linked is not null;
end;
$$;

create function public.capture_whatsapp_message(p_sender text, p_message_id text, p_content text, p_classified jsonb, p_occurred_at timestamptz) returns boolean
language plpgsql security definer set search_path = '' as $$
declare me uuid; receipt text;
begin
  if char_length(trim(p_content)) not between 1 and 20000 or char_length(p_message_id) not between 1 and 512 then raise exception 'Invalid message'; end if;
  select user_id into me from public.whatsapp_links where sender_id = p_sender and connected_at <= p_occurred_at + interval '1 second' for share;
  if me is null then return false; end if;
  insert into public.whatsapp_receipts(message_id, user_id) values(p_message_id, me) on conflict do nothing returning message_id into receipt;
  if receipt is null then return false; end if;
  insert into public.items(user_id, content, type, amount, source, occurred_at, account, direction, priority, due_at)
    values(me, trim(p_content), p_classified->>'type', (p_classified->>'amount')::numeric, 'whatsapp', p_occurred_at,
      p_classified->>'account', p_classified->>'direction', p_classified->>'priority', (p_classified->>'due_at')::timestamptz);
  return true;
end;
$$;

-- Functions default to PUBLIC execution in PostgreSQL. Revoke explicitly.
revoke all on function public.get_my_space(), public.update_my_space(text,text,boolean),
  public.qualify_pouch_referral(uuid), public.claim_pouch_invite(text), public.on_pouch_capture_referral(),
  public.get_my_whatsapp(), public.begin_whatsapp_pairing(text), public.disconnect_my_whatsapp(),
  public.complete_whatsapp_pairing(text,text), public.capture_whatsapp_message(text,text,text,jsonb,timestamptz)
  from public, anon, authenticated;
grant execute on function public.get_my_space(), public.update_my_space(text,text,boolean), public.claim_pouch_invite(text),
  public.get_my_whatsapp(), public.begin_whatsapp_pairing(text), public.disconnect_my_whatsapp() to authenticated;
grant execute on function public.complete_whatsapp_pairing(text,text), public.capture_whatsapp_message(text,text,text,jsonb,timestamptz) to service_role;

commit;
