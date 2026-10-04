-- Standing hosting preference: strong preference to propose when eligible (not auto-accept).

alter type public.member_hosting_standing add value if not exists 'always' after 'default';

comment on column public.group_memberships.hosting_standing is
  'Standing hosting preference: default (happy to host), always (prefer to propose when eligible), prefer_not, never.';

create or replace function public.pick_host_candidate(
  p_group_id uuid,
  p_event_id uuid
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
