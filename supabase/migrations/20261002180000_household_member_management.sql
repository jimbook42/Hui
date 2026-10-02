-- HUI-016: member-managed households inside a group (not admin-only).

create or replace function public.user_household_id_in_group(p_group_id uuid, p_user_id uuid default auth.uid())
returns uuid
language sql
stable
security definer
set search_path = public
as $function$
  select hm.household_id
  from public.household_members hm
  where hm.group_id = p_group_id
    and hm.user_id = p_user_id
  limit 1;
$function$;

create or replace function public.is_household_member(p_household_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $function$
  select exists (
    select 1
    from public.household_members hm
    where hm.household_id = p_household_id
      and hm.user_id = p_user_id
  );
$function$;

create or replace function public.create_household(p_group_id uuid, p_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_user uuid := auth.uid();
  v_name text := trim(p_name);
  v_household_id uuid;
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;

  if not public.is_active_member(p_group_id) then
    raise exception 'not an active group member';
  end if;

  if public.user_household_id_in_group(p_group_id, v_user) is not null then
    raise exception 'already in a household for this group';
  end if;

  if char_length(v_name) < 1 or char_length(v_name) > 80 then
    raise exception 'household name must be between 1 and 80 characters';
  end if;

  insert into public.households (group_id, name)
  values (p_group_id, v_name)
  returning id into v_household_id;

  insert into public.household_members (household_id, group_id, user_id)
  values (v_household_id, p_group_id, v_user);

  return v_household_id;
end;
$function$;

create or replace function public.update_household_name(p_household_id uuid, p_name text)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_user uuid := auth.uid();
  v_name text := trim(p_name);
  v_updated integer;
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;

  if not public.is_household_member(p_household_id, v_user) then
    raise exception 'not a household member';
  end if;

  if char_length(v_name) < 1 or char_length(v_name) > 80 then
    raise exception 'household name must be between 1 and 80 characters';
  end if;

  update public.households
  set name = v_name
  where id = p_household_id;

  get diagnostics v_updated = row_count;
  if v_updated <> 1 then
    raise exception 'household not found';
  end if;
end;
$function$;

create or replace function public.add_household_member(p_household_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_user uuid := auth.uid();
  v_group_id uuid;
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;

  if not public.is_household_member(p_household_id, v_user) then
    raise exception 'not a household member';
  end if;

  select h.group_id into v_group_id
  from public.households h
  where h.id = p_household_id;

  if v_group_id is null then
    raise exception 'household not found';
  end if;

  if p_user_id = v_user then
    raise exception 'already a household member';
  end if;

  if public.user_household_id_in_group(v_group_id, p_user_id) is not null then
    raise exception 'user already belongs to a household in this group';
  end if;

  if not exists (
    select 1
    from public.group_memberships m
    where m.group_id = v_group_id
      and m.user_id = p_user_id
      and m.status = 'active'
  ) then
    raise exception 'user must be an active group member';
  end if;

  insert into public.household_members (household_id, group_id, user_id)
  values (p_household_id, v_group_id, p_user_id);
end;
$function$;

create or replace function public.remove_household_member(p_household_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_user uuid := auth.uid();
  v_group_id uuid;
  v_deleted integer;
  v_remaining integer;
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;

  if not public.is_household_member(p_household_id, v_user) then
    raise exception 'not a household member';
  end if;

  if not public.is_household_member(p_household_id, p_user_id) then
    raise exception 'not in this household';
  end if;

  select h.group_id into v_group_id
  from public.households h
  where h.id = p_household_id;

  delete from public.household_members
  where household_id = p_household_id
    and user_id = p_user_id;

  get diagnostics v_deleted = row_count;
  if v_deleted <> 1 then
    raise exception 'could not remove household member';
  end if;

  select count(*)::integer into v_remaining
  from public.household_members hm
  where hm.household_id = p_household_id;

  if v_remaining = 0 then
    delete from public.households where id = p_household_id;
  end if;
end;
$function$;

comment on function public.create_household(uuid, text) is
  'Active group members create a household and join it. One household per member per group.';
comment on function public.update_household_name(uuid, text) is
  'Household members rename their household.';
comment on function public.add_household_member(uuid, uuid) is
  'Household members add another active group member who is not already in a household.';
comment on function public.remove_household_member(uuid, uuid) is
  'Household members remove a member; deletes the household when empty.';

drop policy if exists households_insert on public.households;
drop policy if exists households_update on public.households;
drop policy if exists households_delete on public.households;
drop policy if exists household_members_insert on public.household_members;
drop policy if exists household_members_delete on public.household_members;

revoke insert, update, delete on public.households from authenticated;
revoke insert, delete on public.household_members from authenticated;

revoke all on function public.user_household_id_in_group(uuid, uuid) from public, anon;
revoke all on function public.is_household_member(uuid, uuid) from public, anon;
revoke all on function public.create_household(uuid, text) from public, anon;
revoke all on function public.update_household_name(uuid, text) from public, anon;
revoke all on function public.add_household_member(uuid, uuid) from public, anon;
revoke all on function public.remove_household_member(uuid, uuid) from public, anon;

grant execute on function public.user_household_id_in_group(uuid, uuid) to authenticated, service_role;
grant execute on function public.is_household_member(uuid, uuid) to authenticated, service_role;
grant execute on function public.create_household(uuid, text) to authenticated, service_role;
grant execute on function public.update_household_name(uuid, text) to authenticated, service_role;
grant execute on function public.add_household_member(uuid, uuid) to authenticated, service_role;
grant execute on function public.remove_household_member(uuid, uuid) to authenticated, service_role;
