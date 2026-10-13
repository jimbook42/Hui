-- HUI-ONBOARDING-003A: host proposal after finalise, gathering-specific contributions.

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

  -- After finalise the selected candidate is no longer "proposed"; still count attendance.
  if not exists (
    select 1
    from public.event_responses er
    join public.event_candidates c on c.id = er.candidate_id
    where c.event_id = p_event_id
      and (
        (v_status = 'proposing' and c.status = 'proposed')
        or (v_status = 'confirmed' and c.status in ('proposed', 'selected'))
      )
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
    if not public.proposed_host_remains_eligible(p_event_id, v_current) then
      if v_creator_initial is not null
         and v_current = v_creator_initial
         and not exists (
           select 1
           from public.event_responses er
           join public.event_candidates c on c.id = er.candidate_id
           where c.event_id = p_event_id
             and (
               (v_status = 'proposing' and c.status = 'proposed')
               or (v_status = 'confirmed' and c.status in ('proposed', 'selected'))
             )
             and er.user_id = v_current
         )
      then
        return v_pending_id;
      end if;

      update public.host_assignments ha
      set status = 'swapped_out'
      where ha.id = v_pending_id
        and ha.status = 'proposed';

      v_pending_id := null;
      v_current := null;
    elsif v_creator_initial is not null and v_current = v_creator_initial then
      return v_pending_id;
    elsif v_best is null or v_best = v_current then
      return v_pending_id;
    else
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

  -- Contributions are requested at propose time; do not copy every group category on confirm.
  if not exists (
    select 1
    from public.host_assignments ha
    where ha.event_id = p_event_id
      and ha.status = 'accepted'
  ) then
    perform public.propose_event_host_for_event(p_event_id, v_actor);
  end if;
end;
$function$;
