-- HUI-012B: Account deletion — purge personal data, preserve shared history, decouple profile from auth.users.

alter table public.profiles
  drop constraint if exists profiles_id_fkey;

alter table public.profiles
  add column if not exists account_deleted_at timestamptz;

comment on column public.profiles.account_deleted_at is
  'Set when the person deletes their account. Profile row may remain for historical foreign keys; auth.users row is removed separately.';

create or replace function public.profiles_before_write()
returns trigger
language plpgsql
set search_path = public
as $function$
begin
  if tg_op = 'UPDATE'
     and old.account_deleted_at is not null
     and not public.running_as_table_owner('public.profiles'::regclass)
  then
    raise exception 'deleted account profiles cannot be updated';
  end if;
  return new;
end;
$function$;

drop trigger if exists profiles_before_write on public.profiles;
create trigger profiles_before_write
  before update on public.profiles
  for each row execute function public.profiles_before_write();

drop policy if exists profiles_select on public.profiles;
create policy profiles_select
  on public.profiles
  for select
  to authenticated
  using (
    (
      id = (select auth.uid())
      and account_deleted_at is null
    )
    or (
      account_deleted_at is null
      and exists (
        select 1
        from public.group_memberships mine
        join public.group_memberships theirs
          on theirs.group_id = mine.group_id
         and theirs.status = 'active'
        where mine.user_id = (select auth.uid())
          and mine.status = 'active'
          and theirs.user_id = profiles.id
      )
    )
  );

create or replace function public._delete_group_cascade(p_group_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $function$
begin
  delete from public.event_memory_attendees
  where memory_id in (
    select em.id from public.event_memories em where em.group_id = p_group_id
  );

  delete from public.event_memories where group_id = p_group_id;
  delete from public.event_responses where group_id = p_group_id;
  delete from public.event_contributions where group_id = p_group_id;
  delete from public.host_assignments where group_id = p_group_id;
  delete from public.event_candidates where group_id = p_group_id;
  delete from public.events where group_id = p_group_id;
  delete from public.recurrence_series where group_id = p_group_id;
  delete from public.contribution_categories where group_id = p_group_id;
  delete from public.dietary_entry_shares where group_id = p_group_id;
  delete from public.household_members where group_id = p_group_id;
  delete from public.households where group_id = p_group_id;
  delete from public.membership_changes where group_id = p_group_id;
  delete from public.group_memberships where group_id = p_group_id;
  delete from public.groups where id = p_group_id;
end;
$function$;

comment on function public._delete_group_cascade(uuid) is
  'Internal: removes one group and all dependent rows. Not callable by clients.';

revoke all on function public._delete_group_cascade(uuid) from public, anon, authenticated;

create or replace function public.delete_my_account_data()
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

  if exists (
    select 1
    from public.profiles p
    where p.id = v_user
      and p.account_deleted_at is not null
  ) then
    raise exception 'account already deleted';
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
      account_deleted_at = now()
  where id = v_user;
end;
$function$;

comment on function public.delete_my_account_data() is
  'Authenticated user only. Removes personal data and active memberships, deletes sole-member groups, anonymises the profile row, and leaves shared historical rows that reference profiles.id. Supabase Auth identity must be removed in application code afterward.';

revoke all on function public.delete_my_account_data() from public, anon;
grant execute on function public.delete_my_account_data() to authenticated, service_role;
