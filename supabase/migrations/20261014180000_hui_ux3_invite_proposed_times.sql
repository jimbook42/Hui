-- HUI-UX3: invite preview lists all proposed times (additive JSON field; backward compatible).

create or replace function public.resolve_group_invite(
  p_token text,
  p_focus_event_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_user uuid := auth.uid();
  v_row record;
  v_inviter_name text;
  v_planning jsonb := null;
  v_event record;
  v_event_found boolean := false;
  v_timezone text := 'Pacific/Auckland';
  v_proposed_starts timestamptz;
  v_proposed_times jsonb;
  v_coordination public.event_status[] := array[
    'proposing'::public.event_status,
    'voting'::public.event_status,
    'awaiting_agreement'::public.event_status,
    'reopened'::public.event_status
  ];
begin
  select * into v_row from public._active_group_invite_row(p_token) limit 1;

  if v_row is null then
    return pg_catalog.jsonb_build_object('status', 'invalid');
  end if;

  select coalesce(gs.timezone, 'Pacific/Auckland')
  into v_timezone
  from public.group_settings gs
  where gs.group_id = v_row.group_id;

  select p.display_name
  into v_inviter_name
  from public.group_invite_links l
  left join public.profiles p on p.id = l.created_by
  where l.id = v_row.link_id;

  if p_focus_event_id is not null then
    select
      e.id,
      e.title,
      e.status::text as status,
      e.planning_target_date,
      e.gathering_type::text as gathering_type,
      e.gathering_type_custom
    into v_event
    from public.events e
    where e.id = p_focus_event_id
      and e.group_id = v_row.group_id
      and e.status = any (v_coordination)
    limit 1;
    v_event_found := found;
  end if;

  if not v_event_found then
    select
      e.id,
      e.title,
      e.status::text as status,
      e.planning_target_date,
      e.gathering_type::text as gathering_type,
      e.gathering_type_custom
    into v_event
    from public.events e
    where e.group_id = v_row.group_id
      and e.status = any (v_coordination)
    order by e.created_at desc
    limit 1;
    v_event_found := found;
  end if;

  if v_event_found then
    select min(c.starts_at)
    into v_proposed_starts
    from public.event_candidates c
    where c.event_id = v_event.id
      and c.status in ('proposed', 'selected');

    select coalesce(
      pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'startsAt',
          c.starts_at,
          'endsAt',
          c.ends_at
        )
        order by c.starts_at
      ),
      '[]'::jsonb
    )
    into v_proposed_times
    from public.event_candidates c
    where c.event_id = v_event.id
      and c.status in ('proposed', 'selected');

    v_planning := pg_catalog.jsonb_build_object(
      'eventId',
      v_event.id,
      'eventTitle',
      v_event.title,
      'status',
      v_event.status,
      'planningTargetDate',
      v_event.planning_target_date,
      'proposedStartsAt',
      v_proposed_starts,
      'proposedTimes',
      v_proposed_times,
      'gatheringType',
      v_event.gathering_type,
      'gatheringTypeCustom',
      v_event.gathering_type_custom
    );
  end if;

  if v_user is not null and public.is_active_member(v_row.group_id) then
    return pg_catalog.jsonb_build_object(
      'status',
      'already_member',
      'groupId',
      v_row.group_id,
      'groupName',
      v_row.group_name,
      'groupTimeZone',
      v_timezone,
      'inviterDisplayName',
      v_inviter_name,
      'planning',
      v_planning
    );
  end if;

  return pg_catalog.jsonb_build_object(
    'status',
    'valid',
    'groupId',
    v_row.group_id,
    'groupName',
    v_row.group_name,
    'groupTimeZone',
    v_timezone,
    'inviterDisplayName',
    v_inviter_name,
    'planning',
    v_planning
  );
end;
$function$;

comment on function public.resolve_group_invite(text, uuid) is
  'Public invite preview: group timezone, optional focus gathering, all proposed candidate times.';
