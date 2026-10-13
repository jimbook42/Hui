-- HUI-022A.5: scope contribution seeding to event creation; host swap vacant notice; swap preview.

create or replace function public.sync_host_bound_contributions(p_event_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_host_user uuid;
  v_display_name text;
  v_group_id uuid;
  v_status public.event_status;
begin
  select e.group_id, e.status
  into v_group_id, v_status
  from public.events e
  where e.id = p_event_id;

  if v_group_id is null then
    return;
  end if;

  if v_status not in ('proposing', 'confirmed') then
    return;
  end if;

  select ha.user_id, ha.display_name
  into v_host_user, v_display_name
  from public.host_assignments ha
  where ha.event_id = p_event_id
    and ha.status = 'accepted'
    and ha.user_id is not null
  order by ha.created_at desc
  limit 1;

  if v_host_user is null then
    update public.event_contributions ec
    set
      user_id = null,
      display_name = null,
      status = 'open'
    from public.contribution_categories c
    where ec.event_id = p_event_id
      and ec.category_id = c.id
      and c.follows_host = true
      and ec.group_id = v_group_id;
    return;
  end if;

  update public.event_contributions ec
  set
    user_id = v_host_user,
    display_name = v_display_name,
    status = 'accepted'
  from public.contribution_categories c
  where ec.event_id = p_event_id
    and ec.category_id = c.id
    and c.follows_host = true
    and ec.group_id = v_group_id;
end;
$function$;

comment on function public.sync_host_bound_contributions(uuid) is
  'Aligns existing host-following contribution rows with the accepted host. Does not add categories the hui did not request.';

comment on function public.seed_event_contributions(uuid, uuid) is
  'Legacy full-group category seed (e.g. historical finalise paths). Not used during host accept or swap sync.';

drop function if exists public.pick_host_candidate(uuid, uuid);

create or replace function public.pick_host_candidate(
  p_group_id uuid,
  p_event_id uuid,
  p_exclude_user uuid default null
)
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  v_avoid_consecutive boolean;
  v_last_host uuid;
  v_pick uuid;
begin
  select coalesce(gs.avoid_consecutive_hosts, false)
  into v_avoid_consecutive
  from public.group_settings gs
  where gs.group_id = p_group_id;

  if coalesce(v_avoid_consecutive, false) then
    select ha.user_id
    into v_last_host
    from public.host_assignments ha
    join public.events e on e.id = ha.event_id
    where ha.group_id = p_group_id
      and ha.status = 'accepted'
      and ha.user_id is not null
      and e.status in ('confirmed', 'completed')
      and e.id is distinct from p_event_id
    order by e.confirmed_at desc nulls last, ha.created_at desc
    limit 1;
  end if;

  select m.user_id
  into v_pick
  from public.group_memberships m
  join public.profiles p on p.id = m.user_id
  where m.group_id = p_group_id
    and m.status = 'active'
    and m.hosting_standing in ('always', 'default')
    and m.user_id is distinct from v_last_host
    and m.user_id is distinct from p_exclude_user
    and public.member_can_attend_event_candidate(m.user_id, p_event_id)
    and not exists (
      select 1
      from public.host_assignments ha
      where ha.event_id = p_event_id
        and ha.user_id = m.user_id
        and ha.status in ('declined', 'swapped_out')
    )
  order by
    case when m.hosting_standing = 'always' then 0 else 1 end,
    (
      select count(*)::integer
      from public.host_assignments ha
      join public.events e on e.id = ha.event_id
      where ha.group_id = p_group_id
        and ha.user_id = m.user_id
        and ha.status = 'accepted'
        and e.status in ('confirmed', 'completed')
    ),
    p.display_name collate "C",
    m.user_id
  limit 1;

  if v_pick is not null then
    return v_pick;
  end if;

  select m.user_id
  into v_pick
  from public.group_memberships m
  join public.profiles p on p.id = m.user_id
  where m.group_id = p_group_id
    and m.status = 'active'
    and m.hosting_standing = 'prefer_not'
    and public.member_can_attend_event_candidate(m.user_id, p_event_id)
    and not exists (
      select 1
      from public.host_assignments ha
      where ha.event_id = p_event_id
        and ha.user_id = m.user_id
        and ha.status in ('declined', 'swapped_out')
    )
    and m.user_id is distinct from v_last_host
    and m.user_id is distinct from p_exclude_user
  order by
    (
      select count(*)::integer
      from public.host_assignments ha
      join public.events e on e.id = ha.event_id
      where ha.group_id = p_group_id
        and ha.user_id = m.user_id
        and ha.status = 'accepted'
        and e.status in ('confirmed', 'completed')
    ),
    p.display_name collate "C",
    m.user_id
  limit 1;

  if v_pick is not null then
    return v_pick;
  end if;

  if coalesce(v_avoid_consecutive, false) and v_last_host is not null then
    select m.user_id
    into v_pick
    from public.group_memberships m
    join public.profiles p on p.id = m.user_id
    where m.group_id = p_group_id
      and m.status = 'active'
      and m.hosting_standing in ('always', 'default')
      and m.user_id is distinct from p_exclude_user
      and public.member_can_attend_event_candidate(m.user_id, p_event_id)
      and not exists (
        select 1
        from public.host_assignments ha
        where ha.event_id = p_event_id
          and ha.user_id = m.user_id
          and ha.status in ('declined', 'swapped_out')
      )
    order by
      case when m.hosting_standing = 'always' then 0 else 1 end,
      (
        select count(*)::integer
        from public.host_assignments ha
        join public.events e on e.id = ha.event_id
        where ha.group_id = p_group_id
          and ha.user_id = m.user_id
          and ha.status = 'accepted'
          and e.status in ('confirmed', 'completed')
      ),
      p.display_name collate "C",
      m.user_id
    limit 1;
  end if;

  if v_pick is not null then
    return v_pick;
  end if;

  if coalesce(v_avoid_consecutive, false) and v_last_host is not null then
    select m.user_id
    into v_pick
    from public.group_memberships m
    join public.profiles p on p.id = m.user_id
    where m.group_id = p_group_id
      and m.status = 'active'
      and m.hosting_standing = 'prefer_not'
      and m.user_id is distinct from p_exclude_user
      and public.member_can_attend_event_candidate(m.user_id, p_event_id)
      and not exists (
        select 1
        from public.host_assignments ha
        where ha.event_id = p_event_id
          and ha.user_id = m.user_id
          and ha.status in ('declined', 'swapped_out')
      )
    order by
      (
        select count(*)::integer
        from public.host_assignments ha
        join public.events e on e.id = ha.event_id
        where ha.group_id = p_group_id
          and ha.user_id = m.user_id
          and ha.status = 'accepted'
          and e.status in ('confirmed', 'completed')
      ),
      p.display_name collate "C",
      m.user_id
    limit 1;
  end if;

  return v_pick;
end;
$function$;

create or replace function public.host_swap_has_replacement(p_event_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  v_user uuid := auth.uid();
  v_group_id uuid;
  v_event_status public.event_status;
  v_assignment_id uuid;
begin
  if v_user is null then
    return false;
  end if;

  select e.group_id, e.status
  into v_group_id, v_event_status
  from public.events e
  where e.id = p_event_id;

  if v_group_id is null or not public.is_active_member(v_group_id) then
    return false;
  end if;

  if v_event_status not in ('proposing', 'confirmed') then
    return false;
  end if;

  select ha.id
  into v_assignment_id
  from public.host_assignments ha
  where ha.event_id = p_event_id
    and ha.user_id = v_user
    and ha.status in ('proposed', 'accepted')
  order by case ha.status when 'accepted' then 0 else 1 end, ha.created_at desc
  limit 1;

  if v_assignment_id is null then
    return false;
  end if;

  return public.pick_host_candidate(v_group_id, p_event_id, v_user) is not null;
end;
$function$;

comment on function public.host_swap_has_replacement(uuid) is
  'Whether another member could be proposed as host if the current host swaps out (preview only).';

revoke all on function public.host_swap_has_replacement(uuid) from public, anon;
grant execute on function public.host_swap_has_replacement(uuid) to authenticated, service_role;

create or replace function public.request_host_swap(p_event_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_user uuid := auth.uid();
  v_group_id uuid;
  v_event_status public.event_status;
  v_assignment_id uuid;
  v_updated integer;
  v_next_host uuid;
  v_display_name text;
  v_new_id uuid;
  v_creator uuid;
  v_event_title text;
  v_group_name text;
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;

  select e.group_id, e.status, e.created_by, e.title
  into v_group_id, v_event_status, v_creator, v_event_title
  from public.events e
  where e.id = p_event_id;

  if v_group_id is null then
    raise exception 'event not found';
  end if;

  if not public.is_active_member(v_group_id) then
    raise exception 'not an active group member';
  end if;

  if v_event_status not in ('proposing', 'confirmed') then
    raise exception 'host swaps are only available while the event is open for coordination';
  end if;

  select ha.id
  into v_assignment_id
  from public.host_assignments ha
  where ha.event_id = p_event_id
    and ha.user_id = v_user
    and ha.status in ('proposed', 'accepted')
  order by case ha.status when 'accepted' then 0 else 1 end, ha.created_at desc
  limit 1;

  if v_assignment_id is null then
    raise exception 'no host assignment for you to swap on this event';
  end if;

  update public.host_assignments ha
  set status = 'swapped_out',
      responded_at = now()
  where ha.id = v_assignment_id
    and ha.user_id = v_user
    and ha.status in ('proposed', 'accepted');

  get diagnostics v_updated = row_count;
  if v_updated <> 1 then
    raise exception 'host swap failed';
  end if;

  update public.events e
  set creator_initial_host_user_id = null
  where e.id = p_event_id;

  v_next_host := public.pick_host_candidate(v_group_id, p_event_id);
  if v_next_host is null then
    perform public.sync_host_bound_contributions(p_event_id);

    if v_creator is not null then
      select g.name into v_group_name from public.groups g where g.id = v_group_id;
      perform public.queue_member_notification(
        v_creator,
        'host_declined'::public.notification_kind,
        'No host for this hui',
        coalesce(
          (select p.display_name from public.profiles p where p.id = v_user),
          'A member'
        ) || ' stepped back from hosting "' || coalesce(v_event_title, 'your hui')
          || '" in ' || coalesce(v_group_name, 'your group')
          || ' and no one else is available to host.',
        v_group_id,
        p_event_id,
        'host_vacant:' || p_event_id::text || ':' || v_user::text
      );
    end if;

    return null;
  end if;

  select p.display_name into v_display_name
  from public.profiles p
  where p.id = v_next_host;

  insert into public.host_assignments (
    event_id,
    group_id,
    user_id,
    status,
    display_name,
    assigned_by
  )
  values (
    p_event_id,
    v_group_id,
    v_next_host,
    'proposed',
    coalesce(v_display_name, 'Member'),
    v_user
  )
  returning id into v_new_id;

  perform public.sync_host_bound_contributions(p_event_id);

  return v_new_id;
end;
$function$;
