-- HUI-020: host assignment, acceptance, and change on confirmed events.

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
  v_host_veto boolean;
  v_new_status public.host_assignment_status;
  v_assignment_id uuid;
  v_existing_accepted uuid;
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

  if v_event_status = 'cancelled' then
    raise exception 'host assignment is closed for cancelled events';
  end if;

  if v_event_status <> 'confirmed' then
    raise exception 'host can only be assigned on confirmed events';
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
  ) then
    raise exception 'host must be an active group member';
  end if;

  select gs.host_veto_enabled
  into v_host_veto
  from public.group_settings gs
  where gs.group_id = v_group_id;

  v_new_status := case
    when coalesce(v_host_veto, false) then 'proposed'::public.host_assignment_status
    else 'accepted'::public.host_assignment_status
  end;

  select ha.id
  into v_existing_accepted
  from public.host_assignments ha
  where ha.event_id = p_event_id
    and ha.status = 'accepted'
    and ha.user_id = p_user_id
  limit 1;

  if v_existing_accepted is not null and v_new_status = 'accepted' then
    return v_existing_accepted;
  end if;

  update public.host_assignments ha
  set status = 'swapped_out'
  where ha.event_id = p_event_id
    and ha.status = 'proposed';

  if v_new_status = 'accepted' then
    update public.host_assignments ha
    set status = 'swapped_out'
    where ha.event_id = p_event_id
      and ha.status = 'accepted';
  end if;

  insert into public.host_assignments (
    event_id,
    group_id,
    user_id,
    status,
    assigned_by
  )
  values (
    p_event_id,
    v_group_id,
    p_user_id,
    v_new_status,
    v_user
  )
  returning id into v_assignment_id;

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

  if v_event_status <> 'confirmed' then
    raise exception 'host responses are only available on confirmed events';
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
    set status = 'accepted'
    where ha.id = v_assignment_id
      and ha.user_id = v_user
      and ha.status = 'proposed';

    get diagnostics v_updated = row_count;
    if v_updated <> 1 then
      raise exception 'host acceptance failed';
    end if;
  else
    update public.host_assignments ha
    set status = 'declined'
    where ha.id = v_assignment_id
      and ha.user_id = v_user
      and ha.status = 'proposed';

    get diagnostics v_updated = row_count;
    if v_updated <> 1 then
      raise exception 'host decline failed';
    end if;
  end if;
end;
$function$;

comment on function public.assign_event_host(uuid, uuid) is
  'Event proposer or group admin assigns a member as host on a confirmed event. With host veto enabled the row stays proposed until the member accepts.';

comment on function public.respond_to_host_assignment(uuid, boolean) is
  'Proposed host accepts or declines their assignment on a confirmed event.';

revoke all on function public.assign_event_host(uuid, uuid) from public, anon;
revoke all on function public.respond_to_host_assignment(uuid, boolean) from public, anon;

grant execute on function public.assign_event_host(uuid, uuid) to authenticated, service_role;
grant execute on function public.respond_to_host_assignment(uuid, boolean) to authenticated, service_role;
