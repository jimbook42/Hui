-- HUI-UX1 retest: majority rule counts only yes responses on this candidate (maybe does not count).

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
  v_yes integer;
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
    count(*) filter (where r.response = 'yes')::integer,
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
    v_yes,
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
  elsif v_rule = 'majority_active_members' and (v_yes < 2 or v_yes * 2 <= v_eligible) then
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
    'yes_count', v_yes,
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
