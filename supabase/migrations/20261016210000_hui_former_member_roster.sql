-- HUI v0.18.12 fix1: roster + display counts for deleted-account responders; free host on upcoming hui.

create or replace function public.candidate_attendance_roster(p_candidate_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  v_event_id uuid;
  v_group_id uuid;
  v_viewer uuid := auth.uid();
  v_maybe_enabled boolean;
  v_members jsonb := '[]'::jsonb;
  r record;
  v_response text;
  v_submitted_late boolean;
begin
  if v_viewer is null then
    raise exception 'not authenticated';
  end if;

  select c.event_id, c.group_id
  into v_event_id, v_group_id
  from public.event_candidates c
  where c.id = p_candidate_id;

  if v_event_id is null or not public.is_active_member(v_group_id) then
    raise exception 'candidate not found';
  end if;

  select gs.maybe_responses_enabled
  into v_maybe_enabled
  from public.group_settings gs
  where gs.group_id = v_group_id;

  for r in
    select m.user_id, p.display_name
    from public.group_memberships m
    join public.profiles p on p.id = m.user_id
    where m.group_id = v_group_id
      and m.status = 'active'
    order by p.display_name collate "C", m.user_id
  loop
    select er.response::text, er.submitted_late
    into v_response, v_submitted_late
    from public.event_responses er
    where er.candidate_id = p_candidate_id
      and er.user_id = r.user_id;

    v_members := v_members || jsonb_build_array(
      jsonb_build_object(
        'user_id', r.user_id,
        'display_name', r.display_name,
        'response', v_response,
        'submitted_late', coalesce(v_submitted_late, false)
      )
    );
  end loop;

  for r in
    select er.user_id, er.response::text as response, er.submitted_late
    from public.event_responses er
    join public.profiles p on p.id = er.user_id
    where er.candidate_id = p_candidate_id
      and er.event_id = v_event_id
      and p.account_deleted_at is not null
      and not exists (
        select 1
        from public.group_memberships m
        where m.group_id = v_group_id
          and m.user_id = er.user_id
          and m.status = 'active'
      )
    order by er.user_id
  loop
    v_members := v_members || jsonb_build_array(
      jsonb_build_object(
        'user_id', r.user_id,
        'display_name', 'Former member',
        'response', r.response,
        'submitted_late', coalesce(r.submitted_late, false)
      )
    );
  end loop;

  return jsonb_build_object(
    'maybe_responses_enabled', coalesce(v_maybe_enabled, true),
    'members', v_members
  );
end;
$function$;

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
  v_deleted_accepted integer;
  v_deleted_yes integer;
  v_deleted_maybe integer;
  v_deleted_unavailable integer;
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

  select
    count(*) filter (
      where er.response = 'yes'
         or (er.response = 'maybe' and v_maybe)
    )::integer,
    count(*) filter (where er.response = 'yes')::integer,
    count(*) filter (where er.response = 'maybe')::integer,
    count(*) filter (where er.response = 'no')::integer
  into
    v_deleted_accepted,
    v_deleted_yes,
    v_deleted_maybe,
    v_deleted_unavailable
  from public.event_responses er
  join public.profiles p on p.id = er.user_id
  where er.candidate_id = p_candidate_id
    and er.event_id = v_event_id
    and p.account_deleted_at is not null
    and not exists (
      select 1
      from public.group_memberships m
      where m.group_id = v_group_id
        and m.user_id = er.user_id
        and m.status = 'active'
    );

  v_reason := null;
  if v_status not in ('proposed', 'selected') then
    v_reason := 'candidate_not_active';
  elsif v_accepted < v_minimum then
    v_reason := 'below_minimum_attendees';
  elsif v_confirm_rule = 'organiser_picks' then
    v_reason := 'organiser_picks';
  elsif v_confirm_rule = 'when_everyone_can_come' and v_yes < v_eligible then
    v_reason := 'when_everyone_can_come';
  elsif v_confirm_rule = 'when_most_can_come' then
    if v_rule_label = 'all_active_members' and v_accepted < v_eligible then
      v_reason := 'all_active_members';
    elsif v_rule_label = 'majority_active_members' and (v_yes < 2 or v_yes * 2 <= v_eligible) then
      v_reason := 'majority_active_members';
    elsif v_rule_label = 'required_participants' and v_required_accepted < v_required then
      v_reason := 'required_participants';
    end if;
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
    'yes_count', v_yes + coalesce(v_deleted_yes, 0),
    'maybe_count', v_maybe_count + coalesce(v_deleted_maybe, 0),
    'unavailable_count', v_unavailable + coalesce(v_deleted_unavailable, 0),
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

  -- UX6: strip place from every hui this member hosted (past, upcoming, any host_assignment status).
  update public.events e
  set location = null,
      location_lat = null,
      location_lng = null
  from public.host_assignments ha
  where ha.event_id = e.id
    and ha.user_id = v_user;

  delete from public.host_assignments ha
  using public.events e
  where ha.event_id = e.id
    and ha.user_id = v_user
    and not (
      e.status in ('completed', 'cancelled')
      or (
        e.status = 'confirmed'
        and e.starts_at is not null
        and e.starts_at < pg_catalog.now()
      )
    );

  update public.events e
  set creator_initial_host_user_id = null
  where e.creator_initial_host_user_id = v_user
    and not (
      e.status in ('completed', 'cancelled')
      or (
        e.status = 'confirmed'
        and e.starts_at is not null
        and e.starts_at < pg_catalog.now()
      )
    );

  update public.host_assignments
  set display_name = 'Former member'
  where user_id = v_user
    and display_name is distinct from 'Former member';

  update public.event_memory_attendees
  set display_name = 'Former member'
  where user_id = v_user
    and display_name is distinct from 'Former member';

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
