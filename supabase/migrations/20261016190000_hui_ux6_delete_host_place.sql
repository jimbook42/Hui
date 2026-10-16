-- HUI-UX6: on account deletion, clear event place on every hui the user hosted (any status).

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

  -- Past hui (responses kept, notes cleared): status completed/cancelled, or confirmed with
  -- starts_at already passed. Upcoming/open hui: proposing/voting/reopened/draft/awaiting_agreement,
  -- or confirmed with starts_at still in the future — delete all of the leaver's responses.
  delete from public.event_responses er
  using public.events e
  where er.user_id = v_user
    and er.event_id = e.id
    and not (
      e.status in ('completed', 'cancelled')
      or (
        e.status = 'confirmed'
        and e.starts_at is not null
        and e.starts_at < pg_catalog.now()
      )
    );

  perform pg_catalog.set_config('hui.account_deletion', '1', true);

  update public.event_responses er
  set note = null
  from public.events e
  where er.user_id = v_user
    and er.event_id = e.id
    and er.note is not null
    and (
      e.status in ('completed', 'cancelled')
      or (
        e.status = 'confirmed'
        and e.starts_at is not null
        and e.starts_at < pg_catalog.now()
      )
    );

  perform pg_catalog.set_config('hui.account_deletion', '', true);

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

  -- UX6: strip place from every hui this member hosted (past, upcoming, any host_assignment status).
  update public.events e
  set location = null,
      location_lat = null,
      location_lng = null
  from public.host_assignments ha
  where ha.event_id = e.id
    and ha.user_id = v_user;

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
