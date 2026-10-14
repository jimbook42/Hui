-- HUI-UX1: invite preview uses proposed candidate time; majority consensus evaluation.
-- Column default for new groups ships in 20261014140002 (after app release).

create or replace function public.candidate_consensus(p_candidate_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  v_event_id uuid;
  v_group_id uuid;
  v_starts_at timestamptz;
  v_ends_at timestamptz;
  v_status public.candidate_status;
  v_rule public.consensus_rule;
  v_minimum integer;
  v_maybe boolean;
  v_eligible integer;
  v_required integer;
  v_accepted integer;
  v_maybe_count integer;
  v_unavailable integer;
  v_no_response integer;
  v_required_accepted integer;
  v_reason text;
begin
  select c.event_id, c.group_id, c.starts_at, c.ends_at, c.status
  into v_event_id, v_group_id, v_starts_at, v_ends_at, v_status
  from public.event_candidates c
  where c.id = p_candidate_id;

  if v_event_id is null then
    raise exception 'candidate not found';
  end if;

  select s.consensus_rule, s.minimum_attendees, s.maybe_responses_enabled
  into v_rule, v_minimum, v_maybe
  from public.group_settings s
  where s.group_id = v_group_id;

  if v_rule is null then
    raise exception 'group settings not found';
  end if;

  select
    count(*)::integer,
    count(*) filter (where m.consensus_required)::integer,
    count(*) filter (
      where r.response = 'yes'
         or (r.response = 'maybe' and v_maybe)
    )::integer,
    count(*) filter (where r.response = 'maybe')::integer,
    count(*) filter (where r.response = 'no')::integer,
    count(*) filter (where r.response is null)::integer,
    count(*) filter (
      where m.consensus_required
        and (
          r.response = 'yes'
          or (r.response = 'maybe' and v_maybe)
        )
    )::integer
  into
    v_eligible,
    v_required,
    v_accepted,
    v_maybe_count,
    v_unavailable,
    v_no_response,
    v_required_accepted
  from public.group_memberships m
  left join public.event_responses r
    on r.candidate_id = p_candidate_id
   and r.user_id = m.user_id
   and r.event_id = v_event_id
  where m.group_id = v_group_id
    and m.status = 'active';

  v_reason := null;
  if v_status not in ('proposed', 'selected') then
    v_reason := 'candidate_not_active';
  elsif v_accepted < v_minimum then
    v_reason := 'below_minimum_attendees';
  elsif v_rule = 'all_active_members' and v_accepted < v_eligible then
    v_reason := 'all_active_members';
  elsif v_rule = 'majority_active_members' and v_accepted * 2 <= v_eligible then
    v_reason := 'majority_active_members';
  elsif v_rule = 'required_participants' and v_required_accepted < v_required then
    v_reason := 'required_participants';
  end if;

  return jsonb_build_object(
    'candidate_id', p_candidate_id,
    'starts_at', v_starts_at,
    'ends_at', v_ends_at,
    'status', v_status,
    'passes', v_reason is null,
    'accepted_count', v_accepted,
    'maybe_count', v_maybe_count,
    'unavailable_count', v_unavailable,
    'no_response_count', v_no_response,
    'eligible_member_count', v_eligible,
    'minimum_attendees', v_minimum,
    'consensus_rule', v_rule,
    'maybe_responses_enabled', v_maybe,
    'required_participant_count', v_required,
    'required_accepted_count', v_required_accepted,
    'failure_reason', v_reason
  );
end;
$function$;

drop function if exists public.resolve_group_invite(text, uuid);

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
  'Public invite preview: group timezone, optional focus gathering, earliest proposed candidate time.';

grant execute on function public.resolve_group_invite(text, uuid) to anon, authenticated, service_role;
