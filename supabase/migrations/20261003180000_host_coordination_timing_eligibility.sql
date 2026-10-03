-- HUI-022A.2: host proposal timing/eligibility, pending invalidation, attendance note privacy.

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
      and c.status in ('proposed', 'selected')
      and (
        er.response = 'yes'
        or (er.response = 'maybe' and coalesce(gs.maybe_responses_enabled, true))
      )
  );
$$;

create or replace function public.proposed_host_remains_eligible(
  p_event_id uuid,
  p_user_id uuid
)
returns boolean
language sql
stable
set search_path = public
as $$
  select
    p_user_id is not null
    and public.member_can_attend_event_candidate(p_user_id, p_event_id);
$$;

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
    if not public.proposed_host_remains_eligible(p_event_id, v_current) then
      if v_creator_initial is not null
         and v_current = v_creator_initial
         and not exists (
           select 1
           from public.event_responses er
           join public.event_candidates c on c.id = er.candidate_id
           where c.event_id = p_event_id
             and c.status = 'proposed'
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

  if not public.member_can_attend_event_candidate(p_user_id, p_event_id) then
    raise exception 'host must have responded that they can attend';
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

drop policy if exists event_responses_select on public.event_responses;

create policy event_responses_select
  on public.event_responses
  for select
  to authenticated
  using (
    public.is_active_member(group_id)
    and user_id = (select auth.uid())
  );

comment on policy event_responses_select on public.event_responses is
  'Members read only their own responses (including private notes). Group-visible attendance status uses candidate_attendance_roster.';

revoke all on function public.proposed_host_remains_eligible(uuid, uuid) from public, anon;
grant execute on function public.proposed_host_remains_eligible(uuid, uuid) to authenticated, service_role;
