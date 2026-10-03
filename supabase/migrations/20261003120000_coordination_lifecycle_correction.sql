-- HUI-022A.1: coordination lifecycle (host before confirm), attendance roster, host eligibility, consensus notifications.

alter table public.events
  add column if not exists creator_initial_host_user_id uuid references public.profiles (id) on delete set null,
  add column if not exists skip_auto_host_proposal boolean not null default false;

comment on column public.events.creator_initial_host_user_id is
  'First group event only: creator-nominated initial host (still a proposal until accepted).';
comment on column public.events.skip_auto_host_proposal is
  'First group event only: creator chose no host; skip automatic host proposals for this event.';

create or replace function public.member_can_attend_event_candidate(
  p_user_id uuid,
  p_event_id uuid
)
returns boolean
language sql
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.event_candidates c
    join public.group_settings gs on gs.group_id = c.group_id
    join public.event_responses er
      on er.candidate_id = c.id
     and er.user_id = p_user_id
    where c.event_id = p_event_id
      and c.status = 'proposed'
      and (
        er.response = 'yes'
        or (er.response = 'maybe' and coalesce(gs.maybe_responses_enabled, true))
      )
  );
$$;

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
    and m.hosting_standing is distinct from 'never'
    and m.user_id is distinct from v_last_host
    and public.member_can_attend_event_candidate(m.user_id, p_event_id)
    and not exists (
      select 1
      from public.host_assignments ha
      where ha.event_id = p_event_id
        and ha.user_id = m.user_id
        and ha.status in ('declined', 'swapped_out')
    )
    and m.hosting_standing is distinct from 'prefer_not'
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
      and m.hosting_standing is distinct from 'never'
      and public.member_can_attend_event_candidate(m.user_id, p_event_id)
      and not exists (
        select 1
        from public.host_assignments ha
        where ha.event_id = p_event_id
          and ha.user_id = m.user_id
          and ha.status in ('declined', 'swapped_out')
      )
      and m.hosting_standing is distinct from 'prefer_not'
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

create or replace function public.coordinate_event_host_after_attendance(
  p_event_id uuid,
  p_assigned_by uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_group_id uuid;
  v_status public.event_status;
  v_hosting_enabled boolean;
  v_skip_auto boolean;
  v_creator_initial uuid;
  v_best uuid;
  v_display_name text;
  v_pending_id uuid;
  v_current uuid;
  v_assignment_id uuid;
begin
  select e.group_id, e.status, e.skip_auto_host_proposal, e.creator_initial_host_user_id
  into v_group_id, v_status, v_skip_auto, v_creator_initial
  from public.events e
  where e.id = p_event_id;

  if v_group_id is null or v_status not in ('proposing', 'confirmed') then
    return null;
  end if;

  if coalesce(v_skip_auto, false) then
    return null;
  end if;

  select coalesce(gs.hosting_enabled, true)
  into v_hosting_enabled
  from public.group_settings gs
  where gs.group_id = v_group_id;

  if not coalesce(v_hosting_enabled, true) then
    return null;
  end if;

  if exists (
    select 1
    from public.host_assignments ha
    where ha.event_id = p_event_id
      and ha.status = 'accepted'
  ) then
    return null;
  end if;

  if not exists (
    select 1
    from public.event_responses er
    join public.event_candidates c on c.id = er.candidate_id
    where c.event_id = p_event_id
      and c.status = 'proposed'
  ) then
    return null;
  end if;

  v_best := public.pick_host_candidate(v_group_id, p_event_id);

  select ha.id, ha.user_id
  into v_pending_id, v_current
  from public.host_assignments ha
  where ha.event_id = p_event_id
    and ha.status = 'proposed'
  order by ha.created_at desc
  limit 1;

  if v_pending_id is not null then
    if v_creator_initial is not null and v_current = v_creator_initial then
      return v_pending_id;
    end if;

    if v_best is null or v_best = v_current then
      return v_pending_id;
    end if;

    update public.host_assignments ha
    set status = 'swapped_out'
    where ha.id = v_pending_id
      and ha.status = 'proposed';

    select p.display_name into v_display_name
    from public.profiles p
    where p.id = v_best;

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
      v_best,
      'proposed',
      coalesce(v_display_name, 'Member'),
      coalesce(p_assigned_by, v_best)
    )
    returning id into v_assignment_id;

    return v_assignment_id;
  end if;

  if v_best is null then
    return null;
  end if;

  select p.display_name into v_display_name
  from public.profiles p
  where p.id = v_best;

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
    v_best,
    'proposed',
    coalesce(v_display_name, 'Member'),
    coalesce(p_assigned_by, v_best)
  )
  returning id into v_assignment_id;

  return v_assignment_id;
end;
$function$;

create or replace function public.propose_creator_initial_host_for_event(
  p_event_id uuid,
  p_host_user_id uuid
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
  v_status public.event_status;
  v_hosting_enabled boolean;
  v_display_name text;
  v_assignment_id uuid;
  v_other_events integer;
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;

  select e.group_id, e.created_by, e.status
  into v_group_id, v_created_by, v_status
  from public.events e
  where e.id = p_event_id;

  if v_group_id is null then
    raise exception 'event not found';
  end if;

  if not public.is_active_member(v_group_id) then
    raise exception 'not an active group member';
  end if;

  if v_created_by is distinct from v_user then
    raise exception 'only the event creator can set the initial host for the first event';
  end if;

  select count(*)::integer
  into v_other_events
  from public.events e
  where e.group_id = v_group_id
    and e.status is distinct from 'cancelled';

  if v_other_events <> 1 then
    raise exception 'initial host choice is only available for the first event in a group';
  end if;

  select coalesce(gs.hosting_enabled, true)
  into v_hosting_enabled
  from public.group_settings gs
  where gs.group_id = v_group_id;

  if not coalesce(v_hosting_enabled, true) then
    raise exception 'hosting is disabled for this group';
  end if;

  if v_status not in ('proposing', 'confirmed') then
    raise exception 'initial host can only be set while the event is open for coordination';
  end if;

  if p_host_user_id is null then
    update public.events
    set skip_auto_host_proposal = true,
        creator_initial_host_user_id = null
    where id = p_event_id;
    return null;
  end if;

  if not exists (
    select 1
    from public.group_memberships m
    where m.group_id = v_group_id
      and m.user_id = p_host_user_id
      and m.status = 'active'
      and m.hosting_standing is distinct from 'never'
  ) then
    raise exception 'host must be an active group member';
  end if;

  update public.events
  set creator_initial_host_user_id = p_host_user_id,
      skip_auto_host_proposal = false
  where id = p_event_id;

  update public.host_assignments ha
  set status = 'swapped_out'
  where ha.event_id = p_event_id
    and ha.status = 'proposed';

  select p.display_name into v_display_name
  from public.profiles p
  where p.id = p_host_user_id;

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
    p_host_user_id,
    'proposed',
    coalesce(v_display_name, 'Member'),
    v_user
  )
  returning id into v_assignment_id;

  return v_assignment_id;
end;
$function$;

create or replace function public.propose_event_host_for_event(
  p_event_id uuid,
  p_assigned_by uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
begin
  return public.coordinate_event_host_after_attendance(p_event_id, p_assigned_by);
end;
$function$;

create or replace function public.trg_maybe_propose_event_host_on_response()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_event_id uuid;
  v_status public.event_status;
begin
  select c.event_id into v_event_id
  from public.event_candidates c
  where c.id = new.candidate_id;

  if v_event_id is null then
    return new;
  end if;

  select e.status into v_status
  from public.events e
  where e.id = v_event_id;

  if v_status in ('proposing', 'confirmed') then
    perform public.coordinate_event_host_after_attendance(v_event_id, new.user_id);
  end if;

  return new;
end;
$function$;

drop trigger if exists event_responses_maybe_propose_host on public.event_responses;
create trigger event_responses_maybe_propose_host
  after insert or update of response on public.event_responses
  for each row execute function public.trg_maybe_propose_event_host_on_response();

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
    'proposed',
    coalesce(v_display_name, 'Member'),
    v_user
  )
  returning id into v_assignment_id;

  perform public.sync_host_bound_contributions(p_event_id);

  return v_assignment_id;
end;
$function$;

create or replace function public.respond_to_host_assignment(
  p_event_id uuid,
  p_accept boolean
)
returns void
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
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;

  select e.group_id, e.status
  into v_group_id, v_event_status
  from public.events e
  where e.id = p_event_id;

  if v_group_id is null then
    raise exception 'event not found';
  end if;

  if not public.is_active_member(v_group_id) then
    raise exception 'not an active group member';
  end if;

  if v_event_status = 'cancelled' then
    raise exception 'host assignment is closed for cancelled events';
  end if;

  if v_event_status not in ('proposing', 'confirmed') then
    raise exception 'host responses are only available while the event is open for coordination';
  end if;

  select ha.id
  into v_assignment_id
  from public.host_assignments ha
  where ha.event_id = p_event_id
    and ha.user_id = v_user
    and ha.status = 'proposed'
  order by ha.created_at desc
  limit 1;

  if v_assignment_id is null then
    raise exception 'no pending host proposal for you on this event';
  end if;

  if p_accept then
    update public.host_assignments ha
    set status = 'swapped_out'
    where ha.event_id = p_event_id
      and ha.status = 'accepted';

    update public.host_assignments ha
    set status = 'accepted',
        responded_at = now()
    where ha.id = v_assignment_id
      and ha.user_id = v_user
      and ha.status = 'proposed';

    get diagnostics v_updated = row_count;
    if v_updated <> 1 then
      raise exception 'host acceptance failed';
    end if;

    perform public.sync_host_bound_contributions(p_event_id);
  else
    update public.host_assignments ha
    set status = 'declined',
        responded_at = now()
    where ha.id = v_assignment_id
      and ha.user_id = v_user
      and ha.status = 'proposed';

    get diagnostics v_updated = row_count;
    if v_updated <> 1 then
      raise exception 'host decline failed';
    end if;

    update public.events e
    set creator_initial_host_user_id = null
    where e.id = p_event_id
      and e.creator_initial_host_user_id = v_user;

    perform public.coordinate_event_host_after_attendance(p_event_id, v_user);
  end if;
end;
$function$;

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
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;

  select e.group_id, e.status
  into v_group_id, v_event_status
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
    and ha.status = 'proposed'
  order by ha.created_at desc
  limit 1;

  if v_assignment_id is null then
    raise exception 'no pending host proposal for you on this event';
  end if;

  update public.host_assignments ha
  set status = 'swapped_out',
      responded_at = now()
  where ha.id = v_assignment_id
    and ha.user_id = v_user
    and ha.status = 'proposed';

  get diagnostics v_updated = row_count;
  if v_updated <> 1 then
    raise exception 'host swap failed';
  end if;

  update public.events e
  set creator_initial_host_user_id = null
  where e.id = p_event_id;

  v_next_host := public.pick_host_candidate(v_group_id, p_event_id);
  if v_next_host is null then
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
    select er.response::text
    into v_response
    from public.event_responses er
    where er.candidate_id = p_candidate_id
      and er.user_id = r.user_id;

    v_members := v_members || jsonb_build_array(
      jsonb_build_object(
        'user_id', r.user_id,
        'display_name', r.display_name,
        'response', v_response
      )
    );
  end loop;

  return jsonb_build_object(
    'maybe_responses_enabled', coalesce(v_maybe_enabled, true),
    'members', v_members
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
  v_timezone text;
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

  select gs.timezone
  into v_timezone
  from public.group_settings gs
  where gs.group_id = v_event.group_id;

  update public.events
  set
    status = 'confirmed',
    starts_at = v_candidate.starts_at,
    ends_at = v_candidate.ends_at,
    confirmed_at = now(),
    timezone = coalesce(v_timezone, 'Pacific/Auckland')
  where id = p_event_id
    and status = 'proposing';

  get diagnostics v_updated = row_count;
  if v_updated <> 1 then
    raise exception 'only a proposing event can be confirmed';
  end if;

  perform public.seed_event_contributions(p_event_id, v_actor);
end;
$function$;

create or replace function public.trg_event_responses_consensus_notifications()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_candidate public.event_candidates%rowtype;
  v_event public.events%rowtype;
  v_group_name text;
  v_result jsonb;
  v_rule public.consensus_rule;
  v_required integer;
  v_title text;
  v_body text;
begin
  select c.* into v_candidate
  from public.event_candidates c
  where c.id = new.candidate_id;

  if not found then
    return new;
  end if;

  select e.* into v_event from public.events e where e.id = v_candidate.event_id;

  if v_event.status is distinct from 'proposing' then
    return new;
  end if;

  v_result := public.candidate_consensus(new.candidate_id);
  if coalesce((v_result ->> 'passes')::boolean, false) is not true then
    return new;
  end if;

  v_rule := (v_result ->> 'consensus_rule')::public.consensus_rule;
  v_required := coalesce((v_result ->> 'required_participant_count')::integer, 0);

  select g.name into v_group_name from public.groups g where g.id = v_event.group_id;

  if v_rule = 'required_participants' and v_required > 0 then
    v_title := 'Required participants available';
    v_body := format(
      'A time for "%s" in %s now has every required participant available.',
      v_event.title,
      coalesce(v_group_name, 'your group')
    );
  elsif v_rule = 'all_active_members' then
    v_title := 'Everyone can make it';
    v_body := format(
      'A time for "%s" in %s now works for every active member.',
      v_event.title,
      coalesce(v_group_name, 'your group')
    );
  else
    v_title := 'Enough people can attend';
    v_body := format(
      'A time for "%s" in %s now meets the minimum attendance requirement.',
      v_event.title,
      coalesce(v_group_name, 'your group')
    );
  end if;

  perform public.notify_group_members_except(
    v_event.group_id,
    new.user_id,
    'consensus_ready'::public.notification_kind,
    v_title,
    v_body,
    v_event.id,
    'consensus_ready:' || v_candidate.id::text
  );

  return new;
end;
$function$;

comment on function public.candidate_attendance_roster(uuid) is
  'Member-visible attendance status for one candidate. Response status is visible; private notes stay out of this payload.';

create or replace function public.seed_event_contributions(p_event_id uuid, p_actor uuid)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_group_id uuid;
  v_status public.event_status;
  v_host_user uuid;
  v_host_name text;
  r record;
begin
  select e.group_id, e.status
  into v_group_id, v_status
  from public.events e
  where e.id = p_event_id;

  if v_group_id is null or v_status not in ('confirmed', 'proposing') then
    return;
  end if;

  select ha.user_id, ha.display_name
  into v_host_user, v_host_name
  from public.host_assignments ha
  where ha.event_id = p_event_id
    and ha.status = 'accepted'
    and ha.user_id is not null
  order by ha.created_at desc
  limit 1;

  for r in
    select c.id, c.name, c.follows_host, c.default_assignee_user_id
    from public.contribution_categories c
    where c.group_id = v_group_id
      and c.archived_at is null
  loop
    if exists (
      select 1
      from public.event_contributions ec
      where ec.event_id = p_event_id
        and ec.category_id = r.id
    ) then
      continue;
    end if;

    if r.follows_host then
      if v_host_user is null then
        insert into public.event_contributions (
          event_id, group_id, category_id, user_id, label, status, assigned_by
        )
        values (
          p_event_id, v_group_id, r.id, null, r.name, 'open', coalesce(p_actor, v_host_user)
        );
      else
        insert into public.event_contributions (
          event_id, group_id, category_id, user_id, label, status, display_name, assigned_by
        )
        values (
          p_event_id,
          v_group_id,
          r.id,
          v_host_user,
          r.name,
          'accepted'::public.contribution_status,
          v_host_name,
          coalesce(p_actor, v_host_user)
        );
      end if;
    elsif r.default_assignee_user_id is not null then
      insert into public.event_contributions (
        event_id,
        group_id,
        category_id,
        user_id,
        label,
        status,
        display_name,
        assigned_by
      )
      select
        p_event_id,
        v_group_id,
        r.id,
        r.default_assignee_user_id,
        r.name,
        'accepted'::public.contribution_status,
        p.display_name,
        coalesce(p_actor, r.default_assignee_user_id)
      from public.profiles p
      where p.id = r.default_assignee_user_id;
    else
      insert into public.event_contributions (
        event_id, group_id, category_id, user_id, label, status, assigned_by
      )
      values (
        p_event_id, v_group_id, r.id, null, r.name, 'open', coalesce(p_actor, p_actor)
      );
    end if;
  end loop;
end;
$function$;

revoke all on function public.member_can_attend_event_candidate(uuid, uuid) from public, anon;
grant execute on function public.member_can_attend_event_candidate(uuid, uuid) to authenticated, service_role;
revoke all on function public.coordinate_event_host_after_attendance(uuid, uuid) from public, anon;
grant execute on function public.coordinate_event_host_after_attendance(uuid, uuid) to authenticated, service_role;
revoke all on function public.propose_creator_initial_host_for_event(uuid, uuid) from public, anon;
grant execute on function public.propose_creator_initial_host_for_event(uuid, uuid) to authenticated, service_role;
