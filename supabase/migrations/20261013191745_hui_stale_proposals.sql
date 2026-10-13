-- Stale proposing events: organiser nudge when nominal passes, auto-cancel after grace.

do $enum$
begin
  alter type public.notification_kind add value 'stale_proposal_passed';
exception
  when duplicate_object then null;
end
$enum$;

do $enum$
begin
  alter type public.notification_kind add value 'stale_proposal_auto_cancelled';
exception
  when duplicate_object then null;
end
$enum$;

create or replace function public.proposal_nominal_date_for_event(p_event_id uuid)
returns date
language sql
stable
set search_path = ''
as $$
  select coalesce(
    e.planning_target_date,
    (
      select min((c.starts_at at time zone coalesce(e.timezone, gs.timezone, 'UTC'))::date)
      from public.event_candidates c
      where c.event_id = e.id
        and c.status in ('proposed', 'selected')
    )
  )
  from public.events e
  inner join public.group_settings gs on gs.group_id = e.group_id
  where e.id = p_event_id;
$$;

comment on function public.proposal_nominal_date_for_event(uuid) is
  'Nominal calendar date for a proposing hui (planning target or earliest candidate day).';

create or replace function public.process_stale_proposals(
  p_as_of date default current_date,
  p_grace_days integer default 3
)
returns table (nudges_queued integer, proposals_cancelled integer)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_event record;
  v_nominal date;
  v_cancel_on date;
  v_notification_id uuid;
  v_nudges integer := 0;
  v_cancelled integer := 0;
  v_title text;
  v_body text;
begin
  if p_grace_days is null or p_grace_days < 0 then
    raise exception 'invalid grace days';
  end if;

  for v_event in
    select
      e.id,
      e.created_by,
      e.group_id,
      e.title,
      g.name as group_name
    from public.events e
    inner join public.groups g on g.id = e.group_id
    where e.status = 'proposing'
  loop
    v_nominal := public.proposal_nominal_date_for_event(v_event.id);
    if v_nominal is null or v_nominal >= p_as_of then
      continue;
    end if;

    v_cancel_on := v_nominal + p_grace_days;

    if p_as_of >= v_cancel_on then
      update public.events e
      set
        status = 'cancelled',
        cancelled_at = pg_catalog.now(),
        updated_at = pg_catalog.now()
      where e.id = v_event.id
        and e.status = 'proposing';

      if found then
        v_cancelled := v_cancelled + 1;
        v_title := 'Proposal cancelled — date passed';
        v_body := 'Your proposing hui “' || v_event.title || '” in ' || v_event.group_name
          || ' was cancelled automatically because it was not confirmed in time.';
        perform public.queue_member_notification(
          v_event.created_by,
          'stale_proposal_auto_cancelled'::public.notification_kind,
          v_title,
          v_body,
          v_event.group_id,
          v_event.id,
          'stale_proposal_auto_cancelled:' || v_event.id::text,
          false
        );
      end if;
      continue;
    end if;

    v_title := 'Proposal date has passed';
    v_body := 'Your proposing hui “' || v_event.title || '” in ' || v_event.group_name
      || ' was planned around ' || to_char(v_nominal, 'DD Mon YYYY')
      || '. Pick a new date or cancel before it is closed automatically.';
    v_notification_id := public.queue_member_notification(
      v_event.created_by,
      'stale_proposal_passed'::public.notification_kind,
      v_title,
      v_body,
      v_event.group_id,
      v_event.id,
      'stale_proposal_passed:' || v_event.id::text,
      false
    );
    if v_notification_id is not null then
      v_nudges := v_nudges + 1;
    end if;
  end loop;

  return query select v_nudges, v_cancelled;
end;
$function$;

comment on function public.process_stale_proposals(date, integer) is
  'Idempotent stale-proposal nudges and auto-cancel after grace (default 3 days past nominal).';

revoke all on function public.process_stale_proposals(date, integer) from public, anon, authenticated;
grant execute on function public.process_stale_proposals(date, integer) to service_role;

create or replace function public.reschedule_proposing_event_nominal(
  p_event_id uuid,
  p_nominal_date date
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
  if p_nominal_date is null then
    raise exception 'nominal date required';
  end if;
  if p_nominal_date < current_date then
    raise exception 'nominal date must be today or later';
  end if;

  select * into v_event
  from public.events e
  where e.id = p_event_id;

  if not found then
    raise exception 'event not found';
  end if;
  if v_event.status <> 'proposing' then
    raise exception 'only proposing events can be rescheduled';
  end if;

  if not (
    v_event.created_by = v_actor
    or public.is_group_admin(v_event.group_id)
  ) then
    raise exception 'not allowed';
  end if;

  update public.events
  set
    planning_target_date = p_nominal_date,
    updated_at = pg_catalog.now()
  where id = p_event_id;
end;
$function$;

comment on function public.reschedule_proposing_event_nominal(uuid, date) is
  'Organiser or admin sets a new planning nominal date for a proposing hui.';

grant execute on function public.reschedule_proposing_event_nominal(uuid, date) to authenticated, service_role;
