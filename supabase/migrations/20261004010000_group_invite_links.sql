-- HUI-022B: reusable group invite links (share URL, no email/SMS).
-- Tokens are high-entropy secrets; the table has no client SELECT policies.

create table public.group_invite_links (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  token text not null,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) on delete set null,
  revoked_at timestamptz,
  constraint group_invite_links_token_length check (char_length(token) >= 32)
);

comment on table public.group_invite_links is
  'Active reusable invite tokens per group. Tokens are only returned via security definer RPCs.';

create unique index group_invite_links_one_active_per_group
  on public.group_invite_links (group_id)
  where revoked_at is null;

create unique index group_invite_links_token_active_idx
  on public.group_invite_links (token)
  where revoked_at is null;

alter table public.group_invite_links enable row level security;
alter table public.group_invite_links force row level security;

revoke all on table public.group_invite_links from public, anon, authenticated;
grant all on table public.group_invite_links to service_role;

create or replace function public.new_group_invite_token()
returns text
language sql
volatile
set search_path = ''
as $function$
  select pg_catalog.replace(
    pg_catalog.gen_random_uuid()::text
      || pg_catalog.gen_random_uuid()::text
      || pg_catalog.gen_random_uuid()::text,
    '-',
    ''
  );
$function$;

create or replace function public._active_group_invite_row(p_token text)
returns table (
  link_id uuid,
  group_id uuid,
  group_name text
)
language plpgsql
stable
security definer
set search_path = ''
as $function$
begin
  if p_token is null or pg_catalog.char_length(pg_catalog.btrim(p_token)) < 32 then
    return;
  end if;

  return query
  select l.id, l.group_id, g.name
  from public.group_invite_links l
  join public.groups g on g.id = l.group_id
  where l.token = pg_catalog.btrim(p_token)
    and l.revoked_at is null;
end;
$function$;

create or replace function public._insert_group_invite_link(p_group_id uuid, p_actor uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_token text;
begin
  v_token := public.new_group_invite_token();

  insert into public.group_invite_links (group_id, token, created_by)
  values (p_group_id, v_token, p_actor);

  return v_token;
end;
$function$;

create or replace function public.get_group_invite_link(p_group_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user uuid := auth.uid();
  v_token text;
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;

  if not public.is_group_admin(p_group_id) then
    raise exception 'not authorised';
  end if;

  select l.token into v_token
  from public.group_invite_links l
  where l.group_id = p_group_id
    and l.revoked_at is null
  limit 1;

  if v_token is not null then
    return v_token;
  end if;

  return public._insert_group_invite_link(p_group_id, v_user);
end;
$function$;

comment on function public.get_group_invite_link(uuid) is
  'Returns the active invite token for a group, creating one when missing. Group admins only.';

create or replace function public.regenerate_group_invite_link(p_group_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;

  if not public.is_group_admin(p_group_id) then
    raise exception 'not authorised';
  end if;

  update public.group_invite_links
  set revoked_at = pg_catalog.now()
  where group_id = p_group_id
    and revoked_at is null;

  return public._insert_group_invite_link(p_group_id, v_user);
end;
$function$;

comment on function public.regenerate_group_invite_link(uuid) is
  'Revokes the current invite link and returns a new token. Group admins only.';

create or replace function public.resolve_group_invite(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_user uuid := auth.uid();
  v_row record;
begin
  select * into v_row from public._active_group_invite_row(p_token) limit 1;

  if v_row is null then
    return pg_catalog.jsonb_build_object('status', 'invalid');
  end if;

  if v_user is not null and public.is_active_member(v_row.group_id) then
    return pg_catalog.jsonb_build_object(
      'status',
      'already_member',
      'groupId',
      v_row.group_id,
      'groupName',
      v_row.group_name
    );
  end if;

  return pg_catalog.jsonb_build_object(
    'status',
    'valid',
    'groupId',
    v_row.group_id,
    'groupName',
    v_row.group_name
  );
end;
$function$;

comment on function public.resolve_group_invite(text) is
  'Public invite preview: group name for valid tokens only; no data for invalid/revoked tokens.';

create or replace function public.join_group_via_invite(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user uuid := auth.uid();
  v_row record;
  v_existing public.group_memberships%rowtype;
  v_had_membership boolean;
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;

  select * into v_row from public._active_group_invite_row(p_token) limit 1;

  if v_row is null then
    return pg_catalog.jsonb_build_object('status', 'invalid');
  end if;

  select * into v_existing
  from public.group_memberships m
  where m.group_id = v_row.group_id
    and m.user_id = v_user;

  v_had_membership := found;

  if v_had_membership and v_existing.status = 'active' then
    return pg_catalog.jsonb_build_object(
      'status',
      'already_member',
      'groupId',
      v_row.group_id
    );
  end if;

  if v_had_membership and v_existing.status = 'removed' then
    update public.group_memberships
    set status = 'active',
        role = 'member'
    where group_id = v_row.group_id
      and user_id = v_user;
  else
    insert into public.group_memberships (group_id, user_id, role, status)
    values (v_row.group_id, v_user, 'member', 'active');
  end if;

  return pg_catalog.jsonb_build_object('status', 'joined', 'groupId', v_row.group_id);
end;
$function$;

comment on function public.join_group_via_invite(text) is
  'Validates an invite token and adds the caller as a member. Idempotent for active members.';

revoke all on function public.new_group_invite_token() from public, anon, authenticated;
revoke all on function public._active_group_invite_row(text) from public, anon, authenticated;
revoke all on function public._insert_group_invite_link(uuid, uuid) from public, anon, authenticated;

revoke all on function public.get_group_invite_link(uuid) from public, anon;
revoke all on function public.regenerate_group_invite_link(uuid) from public, anon;

revoke all on function public.resolve_group_invite(text) from public;
revoke all on function public.join_group_via_invite(text) from public, anon;

grant execute on function public.get_group_invite_link(uuid) to authenticated, service_role;
grant execute on function public.regenerate_group_invite_link(uuid) to authenticated, service_role;
grant execute on function public.resolve_group_invite(text) to anon, authenticated, service_role;
grant execute on function public.join_group_via_invite(text) to authenticated, service_role;
