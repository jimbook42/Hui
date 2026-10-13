-- Reschedule RPCs + GUC-only trigger bypass (repair if 20261013194706 was recorded but not applied).

alter table public.event_reschedule_audit force row level security;

create or replace function public._assert_can_reschedule_confirmed_event(p_event_id uuid)
returns public.events
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

  select * into v_event from public.events where id = p_event_id for update;
  if not found or not public.is_active_member(v_event.group_id) then
    raise exception 'event not found';
  end if;
  if v_event.status <> 'confirmed' then
    raise exception 'only confirmed events can be rescheduled';
  end if;
  if not (
    public.is_group_admin(v_event.group_id)
    or v_event.created_by = v_actor
  ) then
    raise exception 'not allowed';
  end if;
  return v_event;
end;
$function$;

create or replace function public.reschedule_confirmed_event_to_time(
  p_event_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_event public.events;
  v_actor uuid := auth.uid();
  v_candidate_id uuid;
  v_timezone text;
  v_audit_id uuid;
  v_label text;
  v_body text;
begin
  if p_starts_at is null then
    raise exception 'start time required';
  end if;
  if p_ends_at is not null and p_ends_at <= p_starts_at then
    raise exception 'end must be after start';
  end if;

  v_event := public._assert_can_reschedule_confirmed_event(p_event_id);
  perform set_config('hui.internal_reschedule', '1', true);

  select c.id into v_candidate_id
  from public.event_candidates c
  where c.event_id = p_event_id and c.status = 'selected'
  limit 1;

  if v_candidate_id is null then
    raise exception 'no confirmed time on record';
  end if;

  select coalesce(gs.timezone, v_event.timezone, 'Pacific/Auckland')
  into v_timezone
  from public.group_settings gs
  where gs.group_id = v_event.group_id;

  insert into public.event_reschedule_audit (
    event_id,
    group_id,
    rescheduled_by,
    mode,
    from_starts_at,
    from_ends_at,
    to_starts_at,
    to_ends_at
  )
  values (
    p_event_id,
    v_event.group_id,
    v_actor,
    'new_time',
    v_event.starts_at,
    v_event.ends_at,
    p_starts_at,
    p_ends_at
  )
  returning id into v_audit_id;

  delete from public.event_responses er
  using public.event_candidates c
  where c.event_id = p_event_id
    and er.candidate_id = c.id;

  update public.event_candidates
  set
    starts_at = p_starts_at,
    ends_at = p_ends_at,
    status = 'selected'
  where id = v_candidate_id;

  update public.events
  set
    starts_at = p_starts_at,
    ends_at = p_ends_at,
    updated_at = pg_catalog.now()
  where id = p_event_id
    and status = 'confirmed';

  v_label := to_char(
    p_starts_at at time zone v_timezone,
    'Dy DD Mon YYYY, HH24:MI'
  );
  v_body := 'Hui moved to ' || v_label || ' — can you still make it?';

  perform public.notify_group_members_except(
    v_event.group_id,
    v_actor,
    'event_rescheduled'::public.notification_kind,
    'Hui rescheduled',
    v_body,
    p_event_id,
    'event_rescheduled:' || v_audit_id::text
  );

  return v_audit_id;
end;
$function$;

create or replace function public.reopen_confirmed_event_for_proposing(p_event_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_event public.events;
  v_actor uuid := auth.uid();
  v_audit_id uuid;
begin
  v_event := public._assert_can_reschedule_confirmed_event(p_event_id);
  perform set_config('hui.internal_reschedule', '1', true);

  insert into public.event_reschedule_audit (
    event_id,
    group_id,
    rescheduled_by,
    mode,
    from_starts_at,
    from_ends_at,
    to_starts_at,
    to_ends_at
  )
  values (
    p_event_id,
    v_event.group_id,
    v_actor,
    'reopen_proposing',
    v_event.starts_at,
    v_event.ends_at,
    null,
    null
  )
  returning id into v_audit_id;

  delete from public.event_responses er
  using public.event_candidates c
  where c.event_id = p_event_id
    and er.candidate_id = c.id;

  update public.event_candidates
  set status = 'withdrawn'
  where event_id = p_event_id
    and status in ('proposed', 'selected');

  update public.events
  set
    status = 'proposing',
    starts_at = null,
    ends_at = null,
    confirmed_at = null,
    updated_at = pg_catalog.now()
  where id = p_event_id
    and status = 'confirmed';

  perform public.notify_group_members_except(
    v_event.group_id,
    v_actor,
    'event_rescheduled'::public.notification_kind,
    'Hui reopened for planning',
    'Times were cleared so new options can be proposed. You will be asked again when times are set.',
    p_event_id,
    'event_reopened:' || v_audit_id::text
  );

  return v_audit_id;
end;
$function$;

grant execute on function public.reschedule_confirmed_event_to_time(uuid, timestamptz, timestamptz)
  to authenticated, service_role;
grant execute on function public.reopen_confirmed_event_for_proposing(uuid)
  to authenticated, service_role;

revoke all on function public._assert_can_reschedule_confirmed_event(uuid) from public, anon, authenticated;

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
      if (new.starts_at is distinct from old.starts_at or new.ends_at is distinct from old.ends_at)
         and current_setting('hui.internal_reschedule', true) is distinct from '1'
      then
        raise exception 'a confirmed event time cannot be changed';
      end if;
    end if;

    if old.status = 'confirmed'
       and new.status is distinct from 'confirmed'
       and new.status is distinct from 'cancelled'
    then
      if new.status = 'completed'
         and public.running_as_table_owner('public.events'::regclass) then
        return new;
      end if;
      if new.status = 'proposing'
         and current_setting('hui.internal_reschedule', true) = '1' then
        return new;
      end if;
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
  where e.id = new.event_id;

  if v_event_status is null then
    raise exception 'event not found';
  end if;

  if v_event_status = 'confirmed'
     and current_setting('hui.internal_reschedule', true) = '1'
     and tg_op = 'UPDATE'
     and old.status in ('selected', 'proposed')
     and (
       (new.status = 'selected'
         and (new.starts_at is distinct from old.starts_at
              or new.ends_at is distinct from old.ends_at))
       or new.status = 'withdrawn'
     )
  then
    return new;
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
