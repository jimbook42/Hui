-- HUI-012B follow-up: idempotent RPC retry and allow reading own profile when tombstoned.

drop policy if exists profiles_select on public.profiles;
create policy profiles_select
  on public.profiles
  for select
  to authenticated
  using (
    id = (select auth.uid())
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
