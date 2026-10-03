-- HUI-022A.4: allow accepted hosts to request a swap during coordination.

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
    and ha.status in ('proposed', 'accepted')
  order by case ha.status when 'accepted' then 0 else 1 end, ha.created_at desc
  limit 1;

  if v_assignment_id is null then
    raise exception 'no host assignment for you to swap on this event';
  end if;

  update public.host_assignments ha
  set status = 'swapped_out',
      responded_at = now()
  where ha.id = v_assignment_id
    and ha.user_id = v_user
    and ha.status in ('proposed', 'accepted');

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

comment on function public.request_host_swap(uuid) is
  'Current proposed or accepted host asks Hui to suggest another member; prior row becomes swapped_out and a new proposed host is created.';

-- Allow sync_host_bound_contributions (and release flows) to clear assignee on update.
create or replace function public.contributions_before_write()
returns trigger
language plpgsql
set search_path = public
as $function$
declare
  v_name text;
begin
  if tg_op = 'UPDATE' then
    new.event_id = old.event_id;
    new.group_id = old.group_id;
    new.assigned_by = old.assigned_by;
    if old.user_id is not null and new.user_id is not null and new.user_id is distinct from old.user_id then
      new.user_id = old.user_id;
    end if;
    if old.household_id is not null and new.household_id is not null
       and new.household_id is distinct from old.household_id then
      new.household_id = old.household_id;
    end if;
    if new.user_id is not distinct from old.user_id
       and new.household_id is not distinct from old.household_id
    then
      new.display_name = old.display_name;
      return new;
    end if;
  else
    select e.group_id into new.group_id
    from public.events e
    where e.id = new.event_id;
    if new.group_id is null then
      raise exception 'event not found';
    end if;
  end if;

  if new.user_id is not null then
    if not exists (
      select 1
      from public.group_memberships m
      where m.group_id = new.group_id
        and m.user_id = new.user_id
        and m.status = 'active'
    ) then
      raise exception 'contribution assignee must be an active group member';
    end if;
    select p.display_name into v_name
    from public.profiles p
    where p.id = new.user_id;
    new.display_name = v_name;
  elsif new.household_id is not null then
    select h.name into v_name
    from public.households h
    where h.id = new.household_id
      and h.group_id = new.group_id;
    new.display_name = v_name;
  else
    new.display_name = null;
  end if;

  if (new.user_id is not null or new.household_id is not null) and new.display_name is null then
    raise exception 'contribution display name could not be recorded';
  end if;

  return new;
end;
$function$;
