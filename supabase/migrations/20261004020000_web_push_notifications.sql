-- HUI-023: Web Push subscriptions and a delivery outbox for existing in-app notifications.
-- member_notifications stays the canonical record. Push secrets are not client-readable.

alter table public.profiles
  add column if not exists web_push_enabled boolean not null default false;

comment on column public.profiles.web_push_enabled is
  'Account opt-in for Web Push. In-app notifications stay on when this is false.';

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth_key text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint push_subscriptions_endpoint_unique unique (endpoint),
  constraint push_subscriptions_endpoint_length check (char_length(endpoint) between 20 and 2000),
  constraint push_subscriptions_p256dh_length check (char_length(p256dh) between 16 and 200),
  constraint push_subscriptions_auth_key_length check (char_length(auth_key) between 16 and 200),
  constraint push_subscriptions_user_agent_length check (
    user_agent is null or char_length(user_agent) <= 160
  )
);

comment on table public.push_subscriptions is
  'Browser Web Push subscriptions. Keys are written by security definer RPCs and read only by the service role.';

create index push_subscriptions_user_id_idx
  on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;
alter table public.push_subscriptions force row level security;

revoke all on table public.push_subscriptions from public, anon, authenticated;
grant all on table public.push_subscriptions to service_role;

create table public.notification_push_outbox (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.member_notifications (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending',
  attempts integer not null default 0,
  detail text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notification_push_outbox_notification_unique unique (notification_id),
  constraint notification_push_outbox_status_check check (
    status in ('pending', 'sending', 'sent', 'skipped', 'failed')
  ),
  constraint notification_push_outbox_attempts_check check (attempts >= 0),
  constraint notification_push_outbox_detail_length check (
    detail is null or char_length(detail) <= 300
  )
);

comment on table public.notification_push_outbox is
  'Pending Web Push delivery for one member_notifications row. Not a second notification history.';

create index notification_push_outbox_pending_idx
  on public.notification_push_outbox (created_at)
  where status in ('pending', 'sending');

alter table public.notification_push_outbox enable row level security;
alter table public.notification_push_outbox force row level security;

revoke all on table public.notification_push_outbox from public, anon, authenticated;
grant all on table public.notification_push_outbox to service_role;

create or replace function public.queue_member_notification(
  p_user_id uuid,
  p_kind public.notification_kind,
  p_title text,
  p_body text,
  p_group_id uuid,
  p_event_id uuid,
  p_dedupe_key text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_id uuid;
begin
  if p_user_id is null or p_group_id is null or p_dedupe_key is null then
    return null;
  end if;

  if pg_catalog.char_length(pg_catalog.btrim(coalesce(p_title, ''::text))) < 1
     or pg_catalog.char_length(pg_catalog.btrim(coalesce(p_body, ''::text))) < 1 then
    return null;
  end if;

  if not exists (
    select 1
    from public.group_memberships m
    where m.group_id = p_group_id
      and m.user_id = p_user_id
      and m.status = 'active'
  ) then
    return null;
  end if;

  if p_event_id is not null and not exists (
    select 1
    from public.events e
    where e.id = p_event_id
      and e.group_id = p_group_id
  ) then
    return null;
  end if;

  insert into public.member_notifications (
    user_id,
    kind,
    title,
    body,
    group_id,
    event_id,
    dedupe_key
  )
  values (
    p_user_id,
    p_kind,
    pg_catalog.btrim(p_title),
    pg_catalog.btrim(p_body),
    p_group_id,
    p_event_id,
    p_dedupe_key
  )
  on conflict (user_id, dedupe_key) do nothing
  returning id into v_id;

  if v_id is not null then
    insert into public.notification_push_outbox (notification_id, user_id)
    values (v_id, p_user_id);
  end if;

  return v_id;
end;
$function$;

comment on function public.queue_member_notification(uuid, public.notification_kind, text, text, uuid, uuid, text) is
  'Idempotently enqueue one in-app notification and a matching Web Push outbox row.';

revoke all on function public.queue_member_notification(uuid, public.notification_kind, text, text, uuid, uuid, text)
  from public, anon, authenticated;

create or replace function public.register_push_subscription(
  p_endpoint text,
  p_p256dh text,
  p_auth_key text,
  p_user_agent text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user uuid := auth.uid();
  v_endpoint text := pg_catalog.btrim(coalesce(p_endpoint, ''::text));
  v_p256dh text := pg_catalog.btrim(coalesce(p_p256dh, ''::text));
  v_auth text := pg_catalog.btrim(coalesce(p_auth_key, ''::text));
  v_agent text := pg_catalog.left(
    pg_catalog.regexp_replace(pg_catalog.btrim(coalesce(p_user_agent, ''::text)), '[[:cntrl:]]', '', 'g'),
    160
  );
  v_id uuid;
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;

  if pg_catalog.char_length(v_endpoint) < 20
     or pg_catalog.char_length(v_endpoint) > 2000
     or v_endpoint not like 'https://%'
     or pg_catalog.strpos(v_endpoint, ' ') > 0
     or v_p256dh !~ '^[A-Za-z0-9_-]+$'
     or pg_catalog.char_length(v_p256dh) < 16
     or pg_catalog.char_length(v_p256dh) > 200
     or v_auth !~ '^[A-Za-z0-9_-]+$'
     or pg_catalog.char_length(v_auth) < 16
     or pg_catalog.char_length(v_auth) > 200 then
    raise exception 'invalid push subscription';
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = v_user
      and p.account_deleted_at is null
  ) then
    raise exception 'not authenticated';
  end if;

  if v_agent = '' then
    v_agent := null;
  end if;

  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth_key, user_agent)
  values (v_user, v_endpoint, v_p256dh, v_auth, v_agent)
  on conflict (endpoint) do update
  set user_id = excluded.user_id,
      p256dh = excluded.p256dh,
      auth_key = excluded.auth_key,
      user_agent = excluded.user_agent,
      updated_at = pg_catalog.now()
  returning id into v_id;

  return v_id;
end;
$function$;

comment on function public.register_push_subscription(text, text, text, text) is
  'Stores the caller''s Web Push subscription. The same endpoint is updated in place.';

create or replace function public.remove_push_subscription(p_endpoint text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user uuid := auth.uid();
  v_deleted integer;
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;

  delete from public.push_subscriptions
  where user_id = v_user
    and endpoint = pg_catalog.btrim(coalesce(p_endpoint, ''::text));

  get diagnostics v_deleted = row_count;
  return v_deleted > 0;
end;
$function$;

comment on function public.remove_push_subscription(text) is
  'Deletes the caller''s subscription for one endpoint. Other users'' rows are left unchanged.';

create or replace function public.my_push_subscription_state(p_endpoint text)
returns table (
  web_push_enabled boolean,
  device_subscribed boolean,
  subscription_count integer
)
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_user uuid := auth.uid();
  v_endpoint text := pg_catalog.btrim(coalesce(p_endpoint, ''::text));
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;

  return query
  select
    p.web_push_enabled,
    exists (
      select 1
      from public.push_subscriptions s
      where s.user_id = v_user
        and v_endpoint <> ''
        and s.endpoint = v_endpoint
    ),
    (
      select pg_catalog.count(*)::integer
      from public.push_subscriptions s
      where s.user_id = v_user
    )
  from public.profiles p
  where p.id = v_user
    and p.account_deleted_at is null;
end;
$function$;

comment on function public.my_push_subscription_state(text) is
  'Returns the caller''s push preference and device count without subscription keys.';

revoke all on function public.register_push_subscription(text, text, text, text) from public, anon;
revoke all on function public.remove_push_subscription(text) from public, anon;
revoke all on function public.my_push_subscription_state(text) from public, anon;

grant execute on function public.register_push_subscription(text, text, text, text) to authenticated, service_role;
grant execute on function public.remove_push_subscription(text) to authenticated, service_role;
grant execute on function public.my_push_subscription_state(text) to authenticated, service_role;

create or replace function public.delete_my_account_data()
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user uuid := auth.uid();
  v_group_id uuid;
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;

  if exists (
    select 1
    from public.profiles p
    where p.id = v_user
      and p.account_deleted_at is not null
  ) then
    return;
  end if;

  if exists (
    select 1
    from public.group_memberships m
    where m.user_id = v_user
      and m.role = 'owner'
      and m.status = 'active'
      and exists (
        select 1
        from public.group_memberships o
        where o.group_id = m.group_id
          and o.status = 'active'
          and o.user_id <> v_user
      )
  ) then
    raise exception 'transfer group ownership before deleting your account';
  end if;

  for v_group_id in
    select g.id
    from public.groups g
    where exists (
      select 1
      from public.group_memberships m
      where m.group_id = g.id
        and m.user_id = v_user
        and m.status = 'active'
    )
    and not exists (
      select 1
      from public.group_memberships o
      where o.group_id = g.id
        and o.status = 'active'
        and o.user_id <> v_user
    )
  loop
    perform public._delete_group_cascade(v_group_id);
  end loop;

  delete from public.push_subscriptions where user_id = v_user;
  delete from public.member_notifications where user_id = v_user;
  delete from public.dietary_entries where user_id = v_user;

  delete from public.event_responses
  where user_id = v_user
    and visibility = 'private';

  delete from public.household_members where user_id = v_user;

  update public.group_memberships
  set status = 'removed'
  where user_id = v_user
    and status = 'active';

  update public.profiles
  set display_name = 'Former member',
      account_deleted_at = pg_catalog.now(),
      web_push_enabled = false
  where id = v_user;
end;
$function$;
