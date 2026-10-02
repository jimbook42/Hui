-- HUI-010: authoritative consensus summary and event finalisation.
-- Private availability stays behind existing response policies. These functions
-- read those rows as the table owner and return counts only.
-- Confirmation is proposing -> confirmed, and only finalise_event may do it.
-- Lock order for races: candidate row, then event row. Response and candidate
-- writes lock the event row before they change scheduling data.

create or replace function public.events_before_write()
returns trigger
language plpgsql
set search_path = public
as $function$
begin
  if tg_op = 'INSERT' and new.status = 'confirmed' then
    if not public.running_as_table_owner('public.events'::regclass) then
      raise exception 'events are confirmed only by finalisation';
    end if;
  end if;

  if tg_op = 'UPDATE' then
    if new.group_id is distinct from old.group_id
       or new.created_by is distinct from old.created_by
       or new.recurrence_series_id is distinct from old.recurrence_series_id
    then
      raise exception 'event group, creator, and series link are immutable';
    end if;

    if new.status = 'confirmed' and old.status is distinct from 'confirmed' then
      if not public.running_as_table_owner('public.events'::regclass) then
        raise exception 'events are confirmed only by finalisation';
      end if;
      if old.status is distinct from 'proposing' then
        raise exception 'only a proposing event can be confirmed';
      end if;
    end if;

    if old.status = 'confirmed' and new.status = 'confirmed' then
      if new.starts_at is distinct from old.starts_at
         or new.ends_at is distinct from old.ends_at
      then
        raise exception 'a confirmed event time cannot be changed';
      end if;
    end if;

    if old.status = 'confirmed'
       and new.status is distinct from 'confirmed'
       and new.status is distinct from 'cancelled'
    then
      raise exception 'a confirmed event cannot change to that status';
    end if;
  end if;

  return new;
end;
$function$;

create or replace function public.candidates_before_write()
returns trigger
language plpgsql
set search_path = public
as $function$
declare
  v_event_status public.event_status;
begin
  if tg_op = 'UPDATE' then
    new.event_id = old.event_id;
    new.group_id = old.group_id;
    new.proposed_by = old.proposed_by;
  else
    select e.group_id into new.group_id
    from public.events e
    where e.id = new.event_id;

    if new.group_id is null then
      raise exception 'event not found';
    end if;
  end if;

  select e.status into v_event_status
  from public.events e
  where e.id = new.event_id
  for update;

  if v_event_status is null then
    raise exception 'event not found';
  end if;

  if v_event_status in ('confirmed', 'completed', 'cancelled') then
    raise exception 'this event is no longer open for scheduling changes';
  end if;

  if new.status = 'selected'
     and (tg_op = 'INSERT' or old.status is distinct from 'selected')
     and not public.running_as_table_owner('public.event_candidates'::regclass)
  then
    raise exception 'candidates are selected only by finalisation';
  end if;

  return new;
end;
$function$;

create or replace function public.responses_before_write()
returns trigger
language plpgsql
set search_path = public
as $function$
declare
  v_event_status public.event_status;
begin
  if tg_op = 'UPDATE' then
    new.candidate_id = old.candidate_id;
    new.event_id = old.event_id;
    new.group_id = old.group_id;
    new.user_id = old.user_id;
  else
    select c.event_id, c.group_id
    into new.event_id, new.group_id
    from public.event_candidates c
    where c.id = new.candidate_id;

    if new.group_id is null then
      raise exception 'candidate not found';
    end if;
  end if;

  select e.status into v_event_status
  from public.events e
  where e.id = new.event_id
  for update;

  if v_event_status is null then
    raise exception 'event not found';
  end if;

  if v_event_status in ('confirmed', 'completed', 'cancelled') then
    raise exception 'this event is no longer open for scheduling changes';
  end if;

  if not exists (
    select 1
    from public.group_memberships m
    where m.group_id = new.group_id
      and m.user_id = new.user_id
      and m.status = 'active'
  ) then
    raise exception 'responses require an active group member';
  end if;

  if new.response = 'maybe' and not exists (
    select 1
    from public.group_settings s
    where s.group_id = new.group_id
      and s.maybe_responses_enabled
  ) then
    raise exception 'maybe responses are disabled for this group';
  end if;

  return new;
end;
$function$;

-- Aggregate consensus for one candidate. No member identifiers are returned.
-- Not granted to authenticated: event_consensus_summary and finalise_event call it.
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

create or replace function public.event_consensus_summary(p_event_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  v_group_id uuid;
  v_rule public.consensus_rule;
  v_minimum integer;
  v_maybe boolean;
  v_eligible integer;
  v_candidates jsonb;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select e.group_id into v_group_id
  from public.events e
  where e.id = p_event_id;

  if v_group_id is null or not public.is_active_member(v_group_id) then
    raise exception 'event not found';
  end if;

  select s.consensus_rule, s.minimum_attendees, s.maybe_responses_enabled
  into v_rule, v_minimum, v_maybe
  from public.group_settings s
  where s.group_id = v_group_id;

  select count(*)::integer into v_eligible
  from public.group_memberships m
  where m.group_id = v_group_id
    and m.status = 'active';

  select coalesce(
    jsonb_agg(public.candidate_consensus(c.id) order by c.starts_at, c.id),
    '[]'::jsonb
  )
  into v_candidates
  from public.event_candidates c
  where c.event_id = p_event_id
    and c.status in ('proposed', 'selected');

  return jsonb_build_object(
    'eligible_member_count', v_eligible,
    'minimum_attendees', v_minimum,
    'consensus_rule', v_rule,
    'maybe_responses_enabled', v_maybe,
    'candidates', v_candidates
  );
end;
$function$;

create or replace function public.finalise_event(
  p_event_id uuid,
  p_candidate_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_actor uuid := auth.uid();
  v_event public.events%rowtype;
  v_candidate public.event_candidates%rowtype;
  v_result jsonb;
  v_updated integer;
begin
  if v_actor is null then
    raise exception 'not authenticated';
  end if;

  select * into v_candidate
  from public.event_candidates
  where id = p_candidate_id
  for update;

  if not found then
    raise exception 'candidate not found';
  end if;

  select * into v_event
  from public.events
  where id = p_event_id
  for update;

  if not found or not public.is_active_member(v_event.group_id) then
    raise exception 'event not found';
  end if;

  if v_candidate.event_id is distinct from v_event.id
     or v_candidate.group_id is distinct from v_event.group_id
  then
    raise exception 'candidate not found';
  end if;

  if not (
    public.is_group_admin(v_event.group_id)
    or v_event.created_by = v_actor
  ) then
    raise exception 'you cannot finalise this event';
  end if;

  if v_event.status = 'confirmed' then
    raise exception 'this event is already confirmed';
  end if;

  if v_event.status = 'cancelled' then
    raise exception 'cancelled events cannot be confirmed';
  end if;

  if v_event.status is distinct from 'proposing' then
    raise exception 'only a proposing event can be confirmed';
  end if;

  if v_candidate.status = 'withdrawn' then
    raise exception 'a withdrawn candidate cannot be finalised';
  end if;

  if v_candidate.status is distinct from 'proposed' then
    raise exception 'this candidate cannot be finalised';
  end if;

  v_result := public.candidate_consensus(p_candidate_id);
  if coalesce((v_result ->> 'passes')::boolean, false) is not true then
    raise exception 'this candidate does not meet the consensus requirements';
  end if;

  update public.event_candidates
  set status = 'selected'
  where id = p_candidate_id
    and event_id = p_event_id
    and status = 'proposed';

  get diagnostics v_updated = row_count;
  if v_updated <> 1 then
    raise exception 'this candidate cannot be finalised';
  end if;

  update public.events
  set
    status = 'confirmed',
    starts_at = v_candidate.starts_at,
    ends_at = v_candidate.ends_at,
    confirmed_at = now()
  where id = p_event_id
    and status = 'proposing';

  get diagnostics v_updated = row_count;
  if v_updated <> 1 then
    raise exception 'only a proposing event can be confirmed';
  end if;
end;
$function$;

comment on function public.candidate_consensus(uuid) is
  'Aggregate consensus for one candidate. Does not return response identities.';
comment on function public.event_consensus_summary(uuid) is
  'Active-member view of candidate consensus counts. No individual responses.';
comment on function public.finalise_event(uuid, uuid) is
  'Confirms a proposing event on one active candidate that currently passes consensus.';

revoke all on function public.candidate_consensus(uuid) from public, anon, authenticated;
revoke all on function public.event_consensus_summary(uuid) from public, anon;
revoke all on function public.finalise_event(uuid, uuid) from public, anon;
grant execute on function public.event_consensus_summary(uuid) to authenticated, service_role;
grant execute on function public.finalise_event(uuid, uuid) to authenticated, service_role;

drop trigger events_before_write on public.events;
create trigger events_before_write
  before insert or update on public.events
  for each row execute function public.events_before_write();

do $grant$
begin
  -- Security definer callers run as the migration owner and must still be able
  -- to execute the internal aggregate after public execute is revoked.
  execute format(
    'grant execute on function public.candidate_consensus(uuid) to %I',
    current_user
  );
end
$grant$;
