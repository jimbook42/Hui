-- HUI-UX3: per-hui confirm rules + host must say Yes before confirm (backward compatible with v0.18.6).

do $enum$
begin
  create type public.event_confirm_rule as enum (
    'when_most_can_come',
    'when_everyone_can_come',
    'organiser_picks'
  );
exception
  when duplicate_object then null;
end
$enum$;

alter table public.events
  add column if not exists confirm_rule public.event_confirm_rule not null default 'when_most_can_come';

comment on column public.events.confirm_rule is
  'Per-hui rule for auto-confirm and organiser expectations. Default matches legacy majority behaviour.';

-- Host eligibility: Yes on the relevant time(s) only (not maybe).
create or replace function public.member_has_yes_for_hosting(
  p_user_id uuid,
  p_event_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.events e
    join public.event_candidates c on c.event_id = e.id
    join public.event_responses er
      on er.candidate_id = c.id
     and er.user_id = p_user_id
     and er.response = 'yes'
    where e.id = p_event_id
      and (
        (e.status = 'confirmed'::public.event_status and c.status = 'selected'::public.candidate_status)
        or (
          e.status = 'proposing'::public.event_status
          and c.status in ('proposed'::public.candidate_status, 'selected'::public.candidate_status)
        )
      )
  );
$$;

comment on function public.member_has_yes_for_hosting(uuid, uuid) is
  'True when the member said Yes on the confirmed time, or on a proposed time while still planning.';

create or replace function public.event_accepted_host_user_id(p_event_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select ha.user_id
  from public.host_assignments ha
  where ha.event_id = p_event_id
    and ha.status = 'accepted'::public.host_assignment_status
    and ha.user_id is not null
  order by ha.created_at desc
  limit 1;
$$;

create or replace function public.host_yes_required_for_candidate(
  p_event_id uuid,
  p_candidate_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    public.event_accepted_host_user_id(p_event_id) is not null
    and not exists (
      select 1
      from public.event_responses er
      where er.candidate_id = p_candidate_id
        and er.user_id = public.event_accepted_host_user_id(p_event_id)
        and er.response = 'yes'
    );
$$;

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
  v_confirm_rule public.event_confirm_rule;
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
  v_rule_label public.consensus_rule;
begin
  select c.event_id, c.group_id, c.starts_at, c.ends_at, c.status, e.confirm_rule
  into v_event_id, v_group_id, v_starts_at, v_ends_at, v_status, v_confirm_rule
  from public.event_candidates c
  join public.events e on e.id = c.event_id
  where c.id = p_candidate_id;

  if v_event_id is null then
    raise exception 'candidate not found';
  end if;

  select s.consensus_rule, s.minimum_attendees, s.maybe_responses_enabled
  into v_rule_label, v_minimum, v_maybe
  from public.group_settings s
  where s.group_id = v_group_id;

  if v_rule_label is null then
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
  elsif v_confirm_rule = 'organiser_picks' then
    v_reason := 'organiser_picks';
  elsif v_confirm_rule = 'when_everyone_can_come' and v_yes < v_eligible then
    v_reason := 'when_everyone_can_come';
  elsif v_confirm_rule = 'when_most_can_come' and (v_yes < 2 or v_yes * 2 <= v_eligible) then
    v_reason := 'majority_active_members';
  end if;

  if v_reason is null and public.host_yes_required_for_candidate(v_event_id, p_candidate_id) then
    v_reason := 'waiting_on_host';
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
    'consensus_rule', v_rule_label,
    'confirm_rule', v_confirm_rule,
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
  v_confirm_rule public.event_confirm_rule;
  v_minimum integer;
  v_maybe boolean;
  v_eligible integer;
  v_candidates jsonb;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select e.group_id, e.confirm_rule
  into v_group_id, v_confirm_rule
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
    'confirm_rule', v_confirm_rule,
    'maybe_responses_enabled', v_maybe,
    'candidates', v_candidates
  );
end;
$function$;

create or replace function public.try_auto_confirm_event(p_event_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_event public.events%rowtype;
  v_candidate_id uuid;
  v_admin_veto boolean;
  v_ok boolean;
begin
  if pg_catalog.current_setting('hui.skip_auto_confirm', true) = '1' then
    return false;
  end if;

  select * into v_event
  from public.events
  where id = p_event_id
  for update;

  if not found or v_event.status is distinct from 'proposing' then
    return false;
  end if;

  if v_event.confirm_rule = 'organiser_picks'::public.event_confirm_rule then
    return false;
  end if;

  select coalesce(gs.admin_veto_enabled, false)
  into v_admin_veto
  from public.group_settings gs
  where gs.group_id = v_event.group_id;

  if v_admin_veto then
    return false;
  end if;

  v_candidate_id := public.pick_auto_confirm_candidate(p_event_id);
  if v_candidate_id is null then
    return false;
  end if;

  perform set_config('hui.event_confirmed_notify_all', '1', true);
  v_ok := public.apply_event_confirmation(p_event_id, v_candidate_id, v_event.created_by, false);
  perform set_config('hui.event_confirmed_notify_all', '', true);
  return v_ok;
end;
$function$;

create or replace function public.apply_event_confirmation(
  p_event_id uuid,
  p_candidate_id uuid,
  p_actor uuid,
  p_force boolean default false
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_candidate public.event_candidates%rowtype;
  v_event public.events%rowtype;
  v_result jsonb;
  v_updated integer;
  v_timezone text;
  v_passes boolean;
  v_yes integer;
  v_method public.event_confirmation_method;
begin
  if p_actor is null then
    return false;
  end if;

  select * into v_candidate
  from public.event_candidates
  where id = p_candidate_id
  for update;

  if not found then
    return false;
  end if;

  select * into v_event
  from public.events
  where id = p_event_id
  for update;

  if not found
     or v_candidate.event_id is distinct from v_event.id
     or v_candidate.group_id is distinct from v_event.group_id
  then
    return false;
  end if;

  if v_event.status is distinct from 'proposing' then
    return false;
  end if;

  if v_candidate.status is distinct from 'proposed' then
    return false;
  end if;

  v_result := public.candidate_consensus(p_candidate_id);
  v_passes := coalesce((v_result ->> 'passes')::boolean, false);
  v_yes := coalesce((v_result ->> 'yes_count')::integer, 0);

  if public.host_yes_required_for_candidate(p_event_id, p_candidate_id) then
    return false;
  end if;

  if not v_passes then
    if v_event.confirm_rule = 'organiser_picks'::public.event_confirm_rule then
      if v_yes < 1 then
        return false;
      end if;
      v_method := 'organiser';
    elsif coalesce(p_force, false) is not true then
      return false;
    elsif v_yes < 1 then
      return false;
    else
      v_method := 'organiser';
    end if;
  else
    v_method := 'consensus';
  end if;

  update public.event_candidates
  set status = 'selected'
  where id = p_candidate_id
    and event_id = p_event_id
    and status = 'proposed';

  get diagnostics v_updated = row_count;
  if v_updated <> 1 then
    return false;
  end if;

  select gs.timezone
  into v_timezone
  from public.group_settings gs
  where gs.group_id = v_event.group_id;

  update public.events
  set
    status = 'confirmed',
    starts_at = v_candidate.starts_at,
    ends_at = v_candidate.ends_at,
    confirmed_at = pg_catalog.now(),
    timezone = coalesce(v_timezone, 'Pacific/Auckland'),
    response_deadline_at = null,
    confirmation_method = v_method,
    updated_at = pg_catalog.now()
  where id = p_event_id
    and status = 'proposing';

  get diagnostics v_updated = row_count;
  if v_updated <> 1 then
    return false;
  end if;

  if not exists (
    select 1
    from public.host_assignments ha
    where ha.event_id = p_event_id
      and ha.status = 'accepted'
  ) then
    perform public.propose_event_host_for_event(p_event_id, p_actor);
  end if;

  return true;
end;
$function$;

comment on function public.apply_event_confirmation(uuid, uuid, uuid, boolean) is
  'Confirm a proposing event. p_force skips consensus when at least one yes (not maybe). Force and organiser-picks never bypass accepted-host Yes.';

create or replace function public.finalise_event(
  p_event_id uuid,
  p_candidate_id uuid,
  p_force boolean default false
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_event public.events%rowtype;
  v_candidate public.event_candidates%rowtype;
  v_result jsonb;
  v_passes boolean;
  v_yes integer;
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

  if public.host_yes_required_for_candidate(p_event_id, p_candidate_id) then
    raise exception 'waiting on the host to say yes to this time';
  end if;

  v_result := public.candidate_consensus(p_candidate_id);
  v_passes := coalesce((v_result ->> 'passes')::boolean, false);
  v_yes := coalesce((v_result ->> 'yes_count')::integer, 0);

  if not v_passes then
    if v_event.confirm_rule = 'organiser_picks'::public.event_confirm_rule then
      if v_yes < 1 then
        raise exception 'at least one yes is required to confirm this time';
      end if;
    elsif coalesce(p_force, false) is not true then
      raise exception 'this candidate does not meet the consensus requirements';
    elsif v_yes < 1 then
      raise exception 'at least one yes is required to confirm this time';
    end if;
  end if;

  perform set_config('hui.event_confirmed_notify_all', '0', true);
  if not public.apply_event_confirmation(
    p_event_id,
    p_candidate_id,
    v_actor,
    case
      when v_event.confirm_rule = 'organiser_picks'::public.event_confirm_rule then false
      else coalesce(p_force, false)
    end
  ) then
    raise exception 'only a proposing event can be confirmed';
  end if;
  perform set_config('hui.event_confirmed_notify_all', '', true);
end;
$function$;

comment on function public.finalise_event(uuid, uuid, boolean) is
  'Organiser confirms a proposing event. p_force may skip consensus but not accepted-host Yes (see apply_event_confirmation).';

revoke all on function public.finalise_event(uuid, uuid, boolean) from public, anon;
grant execute on function public.finalise_event(uuid, uuid, boolean) to authenticated, service_role;

create or replace function public.proposed_host_remains_eligible(
  p_event_id uuid,
  p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    p_user_id is not null
    and public.member_has_yes_for_hosting(p_user_id, p_event_id);
$$;

create or replace function public.assign_event_host(
  p_event_id uuid,
  p_user_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_user uuid := auth.uid();
  v_group_id uuid;
  v_created_by uuid;
  v_event_status public.event_status;
  v_hosting_enabled boolean;
  v_assignment_id uuid;
  v_display_name text;
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;

  if p_user_id is null then
    raise exception 'host must be a group member';
  end if;

  select e.group_id, e.created_by, e.status
  into v_group_id, v_created_by, v_event_status
  from public.events e
  where e.id = p_event_id;

  if v_group_id is null then
    raise exception 'event not found';
  end if;

  if not public.is_active_member(v_group_id) then
    raise exception 'not an active group member';
  end if;

  select coalesce(gs.hosting_enabled, true)
  into v_hosting_enabled
  from public.group_settings gs
  where gs.group_id = v_group_id;

  if not coalesce(v_hosting_enabled, true) then
    raise exception 'hosting is disabled for this group';
  end if;

  if v_event_status = 'cancelled' then
    raise exception 'host assignment is closed for cancelled events';
  end if;

  if v_event_status not in ('proposing', 'confirmed') then
    raise exception 'host can only be assigned while the event is open for coordination';
  end if;

  if not (public.is_group_admin(v_group_id) or v_created_by = v_user) then
    raise exception 'not permitted to assign a host for this event';
  end if;

  if not exists (
    select 1
    from public.group_memberships m
    where m.group_id = v_group_id
      and m.user_id = p_user_id
      and m.status = 'active'
      and m.hosting_standing is distinct from 'never'
  ) then
    raise exception 'host must be an active group member';
  end if;

  if not public.member_has_yes_for_hosting(p_user_id, p_event_id) then
    raise exception 'host must have said yes to this time';
  end if;

  select p.display_name into v_display_name
  from public.profiles p
  where p.id = p_user_id;

  update public.host_assignments ha
  set status = 'swapped_out'
  where ha.event_id = p_event_id
    and ha.status = 'proposed';

  update public.host_assignments ha
  set status = 'swapped_out'
  where ha.event_id = p_event_id
    and ha.status = 'accepted';

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
    p_user_id,
    'accepted',
    v_display_name,
    v_user
  )
  returning id into v_assignment_id;

  perform public.sync_host_bound_contributions(p_event_id);

  return v_assignment_id;
end;
$function$;

-- pick_host_candidate: only members who said Yes on a relevant candidate time.
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
    and public.member_has_yes_for_hosting(m.user_id, p_event_id)
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
    and public.member_has_yes_for_hosting(m.user_id, p_event_id)
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
      and public.member_has_yes_for_hosting(m.user_id, p_event_id)
      and not exists (
        select 1
        from public.host_assignments ha
        where ha.event_id = p_event_id
          and ha.user_id = m.user_id
          and ha.status in ('declined', 'swapped_out')
      )
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
  end if;

  return v_pick;
end;
$function$;

create or replace function public.update_event_confirm_rule(
  p_event_id uuid,
  p_confirm_rule public.event_confirm_rule
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_event public.events%rowtype;
begin
  if v_actor is null then
    raise exception 'not authenticated';
  end if;

  if p_confirm_rule is null then
    raise exception 'invalid confirm rule';
  end if;

  select * into v_event
  from public.events
  where id = p_event_id
  for update;

  if not found or not public.is_active_member(v_event.group_id) then
    raise exception 'event not found';
  end if;

  if not (
    public.is_group_admin(v_event.group_id)
    or v_event.created_by = v_actor
  ) then
    raise exception 'not permitted to update this hui';
  end if;

  if v_event.status is distinct from 'proposing' then
    raise exception 'confirm rule can only be changed while proposing';
  end if;

  update public.events
  set confirm_rule = p_confirm_rule, updated_at = pg_catalog.now()
  where id = p_event_id;
end;
$function$;

comment on function public.update_event_confirm_rule(uuid, public.event_confirm_rule) is
  'Organiser updates per-hui confirm rule while still proposing.';

revoke all on function public.update_event_confirm_rule(uuid, public.event_confirm_rule) from public, anon;
grant execute on function public.update_event_confirm_rule(uuid, public.event_confirm_rule) to authenticated, service_role;

-- Extend propose_group_event with optional confirm rule (default column handles null).
create or replace function public.propose_group_event(
  p_group_id uuid,
  p_title text,
  p_location text,
  p_notes text,
  p_recurrence jsonb,
  p_candidates jsonb,
  p_set_initial_host boolean,
  p_initial_host_user_id uuid,
  p_location_lat double precision,
  p_location_lng double precision,
  p_gathering_type public.gathering_type,
  p_gathering_type_custom text,
  p_requested_contributions jsonb default '[]'::jsonb,
  p_organiser_commits_host boolean default false,
  p_confirm_rule public.event_confirm_rule default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_title text;
  v_location text;
  v_notes text;
  v_series_id uuid;
  v_event_id uuid;
  v_candidate jsonb;
  v_starts timestamptz;
  v_ends timestamptz;
  v_count integer;
  v_i integer;
  v_seen text[] := array[]::text[];
  v_key text;
  v_planning_target date;
  v_canonical uuid;
  v_unit public.cadence_unit;
  v_interval integer;
  v_starts_on date;
  v_series_title text;
  v_gathering_custom text;
  v_confirm_rule public.event_confirm_rule;
begin
  if v_actor is null then
    raise exception 'not authenticated';
  end if;

  v_confirm_rule := coalesce(p_confirm_rule, 'when_most_can_come'::public.event_confirm_rule);

  if not public.can_propose_in_group(p_group_id) then
    raise exception 'you cannot propose events in this group';
  end if;

  if p_gathering_type is null then
    raise exception 'choose what you are planning';
  end if;

  v_gathering_custom := nullif(pg_catalog.btrim(coalesce(p_gathering_type_custom, '')), '');
  if p_gathering_type = 'other'::public.gathering_type and v_gathering_custom is null then
    raise exception 'describe what you are planning';
  end if;

  v_title := pg_catalog.btrim(p_title);
  if pg_catalog.char_length(v_title) < 1 or pg_catalog.char_length(v_title) > 160 then
    raise exception 'enter a valid event title';
  end if;

  if p_location is not null then
    v_location := pg_catalog.btrim(p_location);
    if v_location = '' then
      v_location := null;
    elsif pg_catalog.char_length(v_location) > 200 then
      raise exception 'location is too long';
    end if;
  else
    v_location := null;
  end if;

  if (p_location_lat is null) <> (p_location_lng is null) then
    raise exception 'enter a valid map location';
  end if;
  if p_location_lat is not null and (
       p_location_lat < -90 or p_location_lat > 90
       or p_location_lng < -180 or p_location_lng > 180
     ) then
    raise exception 'enter a valid map location';
  end if;

  if p_notes is not null then
    v_notes := pg_catalog.btrim(p_notes);
    if v_notes = '' then
      v_notes := null;
    elsif pg_catalog.char_length(v_notes) > 2000 then
      raise exception 'notes are too long';
    end if;
  else
    v_notes := null;
  end if;

  v_planning_target := null;
  v_series_id := null;

  if p_recurrence is not null and p_recurrence <> 'null'::jsonb then
    if not (
      p_recurrence ? 'series_title'
      and p_recurrence ? 'interval_unit'
      and p_recurrence ? 'interval_count'
      and p_recurrence ? 'starts_on'
    ) then
      raise exception 'enter valid recurrence settings';
    end if;

    v_series_title := pg_catalog.btrim(p_recurrence ->> 'series_title');
    if pg_catalog.char_length(v_series_title) < 1
       or pg_catalog.char_length(v_series_title) > 160 then
      raise exception 'enter valid recurrence settings';
    end if;

    if (p_recurrence ->> 'interval_unit') not in ('week', 'month') then
      raise exception 'enter valid recurrence settings';
    end if;

    v_interval := (p_recurrence ->> 'interval_count')::integer;
    if v_interval < 1 then
      raise exception 'enter valid recurrence settings';
    end if;

    v_unit := (p_recurrence ->> 'interval_unit')::public.cadence_unit;
    v_starts_on := (p_recurrence ->> 'starts_on')::date;

    if p_recurrence ? 'planning_target_date'
       and p_recurrence ->> 'planning_target_date' is not null
       and pg_catalog.btrim(p_recurrence ->> 'planning_target_date') <> '' then
      v_planning_target := (p_recurrence ->> 'planning_target_date')::date;
    elsif v_starts_on is not null then
      v_planning_target := v_starts_on;
    end if;

    if v_planning_target is not null and exists (
      select 1
      from public.events e
      where e.group_id = p_group_id
        and e.planning_target_date = v_planning_target
        and e.status <> 'cancelled'
    ) then
      raise exception 'a hui is already being planned for this cycle';
    end if;

    select gs.canonical_recurrence_series_id
    into v_canonical
    from public.group_settings gs
    where gs.group_id = p_group_id;

    if v_canonical is not null then
      select rs.id
      into v_series_id
      from public.recurrence_series rs
      where rs.id = v_canonical
        and rs.group_id = p_group_id
        and rs.archived_at is null;
    end if;

    if v_series_id is null then
      insert into public.recurrence_series (
        group_id,
        title,
        interval_unit,
        interval_count,
        starts_on,
        created_by
      )
      values (
        p_group_id,
        v_series_title,
        v_unit,
        v_interval,
        v_starts_on,
        v_actor
      )
      returning id into v_series_id;

      update public.group_settings
      set
        recurrence_interval_unit = v_unit,
        recurrence_interval_count = v_interval,
        recurrence_anchor_date = v_starts_on,
        canonical_recurrence_series_id = v_series_id
      where group_id = p_group_id;
    end if;
  end if;

  if not public.group_allows_event(p_group_id, v_series_id) then
    raise exception 'this event type is not allowed in this group';
  end if;

  if p_candidates is null or jsonb_typeof(p_candidates) <> 'array' then
    raise exception 'add at least one proposed time';
  end if;

  v_count := jsonb_array_length(p_candidates);
  if v_count < 1 then
    raise exception 'add at least one proposed time';
  end if;

  for v_i in 0 .. (v_count - 1) loop
    v_candidate := p_candidates -> v_i;
    if not (v_candidate ? 'starts_at') then
      raise exception 'invalid candidate time';
    end if;

    v_starts := (v_candidate ->> 'starts_at')::timestamptz;
    v_ends := nullif(pg_catalog.btrim(coalesce(v_candidate ->> 'ends_at', '')), '')::timestamptz;

    if v_starts is null or (v_ends is not null and v_ends <= v_starts) then
      raise exception 'invalid candidate time';
    end if;

    v_key := v_starts::text || '|' || coalesce(v_ends::text, '');
    if v_key = any (v_seen) then
      raise exception 'duplicate candidate time';
    end if;
    v_seen := array_append(v_seen, v_key);
  end loop;

  insert into public.events (
    group_id,
    recurrence_series_id,
    title,
    status,
    location,
    location_lat,
    location_lng,
    notes,
    starts_at,
    ends_at,
    planning_target_date,
    gathering_type,
    gathering_type_custom,
    created_by,
    confirm_rule
  )
  values (
    p_group_id,
    v_series_id,
    v_title,
    'proposing'::public.event_status,
    v_location,
    p_location_lat,
    p_location_lng,
    v_notes,
    null,
    null,
    v_planning_target,
    p_gathering_type,
    v_gathering_custom,
    v_actor,
    v_confirm_rule
  )
  returning id into v_event_id;

  for v_i in 0 .. (v_count - 1) loop
    v_candidate := p_candidates -> v_i;
    v_starts := (v_candidate ->> 'starts_at')::timestamptz;
    v_ends := nullif(pg_catalog.btrim(coalesce(v_candidate ->> 'ends_at', '')), '')::timestamptz;

    insert into public.event_candidates (
      event_id,
      group_id,
      starts_at,
      ends_at,
      proposed_by
    )
    values (
      v_event_id,
      p_group_id,
      v_starts,
      v_ends,
      v_actor
    );
  end loop;

  if p_set_initial_host then
    perform public.propose_creator_initial_host_for_event(v_event_id, p_initial_host_user_id);
  end if;

  if coalesce(p_organiser_commits_host, false) then
    perform public.commit_proposer_as_confirmed_host(v_event_id);
  end if;

  if p_requested_contributions is not null
     and jsonb_typeof(p_requested_contributions) = 'array'
     and jsonb_array_length(p_requested_contributions) > 0 then
    perform public.apply_proposal_contribution_requests(
      v_event_id,
      v_actor,
      p_requested_contributions
    );
  end if;

  return v_event_id;
end;
$function$;

revoke all on function public.propose_group_event(
  uuid, text, text, text, jsonb, jsonb, boolean, uuid, double precision, double precision,
  public.gathering_type, text, jsonb, boolean
) from public, anon;

revoke all on function public.propose_group_event(
  uuid, text, text, text, jsonb, jsonb, boolean, uuid, double precision, double precision,
  public.gathering_type, text, jsonb, boolean, public.event_confirm_rule
) from public, anon;

grant execute on function public.propose_group_event(
  uuid, text, text, text, jsonb, jsonb, boolean, uuid, double precision, double precision,
  public.gathering_type, text, jsonb, boolean
) to authenticated, service_role;

grant execute on function public.propose_group_event(
  uuid, text, text, text, jsonb, jsonb, boolean, uuid, double precision, double precision,
  public.gathering_type, text, jsonb, boolean, public.event_confirm_rule
) to authenticated, service_role;

revoke all on function public.candidate_consensus(uuid) from public, anon, authenticated;
grant execute on function public.candidate_consensus(uuid) to service_role;

notify pgrst, 'reload schema';
