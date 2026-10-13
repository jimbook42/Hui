-- Reopen after confirm: withdraw old candidates (none on the table); audit keeps prior times.

grant select on public.event_reschedule_audit to authenticated;

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
