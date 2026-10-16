-- HUI-UX5 fix2: G1 home location column privacy; G2–G3 account deletion hardening.

-- G1: Co-members must not read saved home coordinates via the profiles API.
revoke select on table public.profiles from authenticated;

grant select (
  id,
  display_name,
  created_at,
  updated_at,
  account_deleted_at,
  personal_setup_completed_at,
  member_reconnect_reminders_enabled,
  web_push_enabled,
  push_event_proposals_enabled,
  push_consensus_ready_enabled,
  push_event_confirmed_enabled,
  push_host_assignment_enabled,
  push_contribution_changes_enabled
) on table public.profiles to authenticated;

create or replace function public.my_home_location()
returns table (
  home_location_label text,
  home_location_lat double precision,
  home_location_lng double precision
)
language sql
security definer
set search_path = ''
stable
as $function$
  select p.home_location_label, p.home_location_lat, p.home_location_lng
  from public.profiles p
  where p.id = auth.uid();
$function$;

comment on function public.my_home_location() is
  'Returns the caller''s saved home address only (bypasses home_location column SELECT revoke).';

revoke all on function public.my_home_location() from public, anon;
grant execute on function public.my_home_location() to authenticated, service_role;

create or replace function public.co_member_host_home_location(
  p_host_user_id uuid,
  p_group_id uuid
)
returns table (
  home_location_label text,
  home_location_lat double precision,
  home_location_lng double precision
)
language plpgsql
security definer
set search_path = ''
stable
as $function$
begin
  if auth.uid() is null then
    return;
  end if;

  -- Host-location UI is for the accepted host themselves; co-members never receive home columns.
  if auth.uid() is distinct from p_host_user_id then
    return;
  end if;

  if not public.is_active_member(p_group_id) then
    return;
  end if;

  return query
  select p.home_location_label, p.home_location_lat, p.home_location_lng
  from public.profiles p
  where p.id = p_host_user_id;
end;
$function$;

comment on function public.co_member_host_home_location(uuid, uuid) is
  'Returns a member''s saved home for hosting when they are the caller and active in the group.';

revoke all on function public.co_member_host_home_location(uuid, uuid) from public, anon;
grant execute on function public.co_member_host_home_location(uuid, uuid) to authenticated, service_role;

-- Allow account deletion to overwrite denormalised display_name snapshots (triggers normally freeze them).
create or replace function public.hosts_before_write()
returns trigger
language plpgsql
set search_path = public
as $function$
declare
  v_name text;
begin
  if tg_op = 'UPDATE'
     and coalesce(pg_catalog.current_setting('hui.account_deletion', true), '') = '1'
  then
    return new;
  end if;

  if tg_op = 'UPDATE' then
    new.event_id = old.event_id;
    new.group_id = old.group_id;
    new.user_id = old.user_id;
    new.household_id = old.household_id;
    new.display_name = old.display_name;
    new.assigned_by = old.assigned_by;
    if new.status is distinct from old.status
       and new.status <> 'proposed'
       and new.responded_at is null
    then
      new.responded_at = now();
    end if;
    return new;
  end if;

  select e.group_id into new.group_id
  from public.events e
  where e.id = new.event_id;

  if new.group_id is null then
    raise exception 'event not found';
  end if;

  if new.user_id is not null then
    if not exists (
      select 1
      from public.group_memberships m
      where m.group_id = new.group_id
        and m.user_id = new.user_id
        and m.status = 'active'
    ) then
      raise exception 'host must be an active group member';
    end if;
    select p.display_name into v_name
    from public.profiles p
    where p.id = new.user_id;
  else
    select h.name into v_name
    from public.households h
    where h.id = new.household_id
      and h.group_id = new.group_id;
  end if;

  if v_name is null then
    raise exception 'host display name could not be recorded';
  end if;
  new.display_name = v_name;
  return new;
end;
$function$;

create or replace function public.contributions_before_write()
returns trigger
language plpgsql
set search_path = public
as $function$
declare
  v_name text;
begin
  if tg_op = 'UPDATE'
     and coalesce(pg_catalog.current_setting('hui.account_deletion', true), '') = '1'
  then
    return new;
  end if;

  if tg_op = 'UPDATE' then
    new.event_id = old.event_id;
    new.group_id = old.group_id;
    new.assigned_by = old.assigned_by;
    if old.user_id is not null and new.user_id is not null and new.user_id is distinct from old.user_id then
      new.user_id = old.user_id;
    end if;
    if old.household_id is not null and new.household_id is not null
       and new.household_id is distinct from old.household_id then
      new.household_id = old.household_id;
    end if;
    if new.user_id is not distinct from old.user_id
       and new.household_id is not distinct from old.household_id
    then
      new.display_name = old.display_name;
      return new;
    end if;
  else
    select e.group_id into new.group_id
    from public.events e
    where e.id = new.event_id;
    if new.group_id is null then
      raise exception 'event not found';
    end if;
  end if;

  if new.user_id is not null then
    if not exists (
      select 1
      from public.group_memberships m
      where m.group_id = new.group_id
        and m.user_id = new.user_id
        and m.status = 'active'
    ) then
      raise exception 'contribution assignee must be an active group member';
    end if;
    select p.display_name into v_name
    from public.profiles p
    where p.id = new.user_id;
    new.display_name = v_name;
  elsif new.household_id is not null then
    select h.name into v_name
    from public.households h
    where h.id = new.household_id
      and h.group_id = new.group_id;
    new.display_name = v_name;
  else
    new.display_name = null;
  end if;

  if (new.user_id is not null or new.household_id is not null) and new.display_name is null then
    raise exception 'contribution display name could not be recorded';
  end if;
  return new;
end;
$function$;

create or replace function public.memory_attendees_before_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_group_id uuid;
  v_name text;
begin
  if tg_op = 'UPDATE'
     and coalesce(pg_catalog.current_setting('hui.account_deletion', true), '') = '1'
  then
    return new;
  end if;

  select mem.group_id into v_group_id
  from public.event_memories mem
  where mem.id = new.memory_id;

  if v_group_id is null then
    raise exception 'memory not found';
  end if;

  if not exists (
    select 1
    from public.group_memberships m
    where m.group_id = v_group_id
      and m.user_id = new.user_id
  ) then
    raise exception 'memory attendees must belong to the group';
  end if;

  if tg_op = 'INSERT' then
    select p.display_name into v_name
    from public.profiles p
    where p.id = new.user_id;
    if v_name is null then
      raise exception 'attendee profile not found';
    end if;
    new.display_name = v_name;
  else
    new.memory_id = old.memory_id;
    new.user_id = old.user_id;
    new.display_name = old.display_name;
  end if;
  return new;
end;
$function$;

-- G2–G3: extend account deletion.
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

  delete from public.group_member_standing_availability where user_id = v_user;

  delete from public.event_responses where user_id = v_user;

  delete from public.household_members where user_id = v_user;

  update public.group_memberships
  set status = 'removed'
  where user_id = v_user
    and status = 'active';

  perform pg_catalog.set_config('hui.account_deletion', '1', true);

  update public.event_contributions
  set display_name = 'Former member'
  where user_id = v_user
    and display_name is distinct from 'Former member';

  update public.host_assignments
  set display_name = 'Former member'
  where user_id = v_user
    and display_name is distinct from 'Former member';

  update public.event_memory_attendees
  set display_name = 'Former member'
  where user_id = v_user
    and display_name is distinct from 'Former member';

  perform pg_catalog.set_config('hui.account_deletion', '', true);

  update public.profiles
  set display_name = 'Former member',
      account_deleted_at = pg_catalog.now(),
      web_push_enabled = false,
      home_location_label = null,
      home_location_lat = null,
      home_location_lng = null
  where id = v_user;
end;
$function$;
