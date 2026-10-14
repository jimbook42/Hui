-- HUI-COORD: lifecycle coordination audit — planning responses, deadlines, stale cancel notify path.

create or replace function public.apply_event_confirmation(
  p_event_id uuid,
  p_candidate_id uuid,
  p_actor uuid
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
  if coalesce((v_result ->> 'passes')::boolean, false) is not true then
    return false;
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

create or replace function public.enqueue_proposal_deadline_reminders(
  p_as_of timestamptz default pg_catalog.now()
)
returns integer
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_event record;
  v_member uuid;
  v_queued integer := 0;
  v_tz text;
  v_label text;
  v_body text;
  v_title text := 'Reply needed soon';
begin
  for v_event in
    select e.id, e.group_id, e.title, g.name as group_name, e.response_deadline_at
    from public.events e
    inner join public.groups g on g.id = e.group_id
    where e.status in ('proposing', 'voting', 'awaiting_agreement', 'reopened', 'draft')
      and e.response_deadline_at is not null
      and e.response_deadline_at > p_as_of
      and e.response_deadline_at <= p_as_of + interval '24 hours'
  loop
    select coalesce(gs.timezone, 'Pacific/Auckland')
    into v_tz
    from public.group_settings gs
    where gs.group_id = v_event.group_id;

    v_label := to_char(
      v_event.response_deadline_at at time zone v_tz,
      'Dy DD Mon YYYY, HH24:MI'
    );
    v_body := format(
      'Reply by %s for "%s" in %s.',
      v_label,
      v_event.title,
      v_event.group_name
    );

    for v_member in
      select m.user_id
      from public.group_memberships m
      where m.group_id = v_event.group_id
        and m.status = 'active'
        and not exists (
          select 1
          from public.event_responses er
          inner join public.event_candidates c on c.id = er.candidate_id
          where c.event_id = v_event.id
            and c.status = 'proposed'
            and er.user_id = m.user_id
        )
    loop
      if public.queue_member_notification(
        v_member,
        'proposal_deadline_reminder'::public.notification_kind,
        v_title,
        v_body,
        v_event.group_id,
        v_event.id,
        'proposal_deadline_reminder:' || v_event.id::text || ':' || v_member::text,
        false
      ) is not null then
        v_queued := v_queued + 1;
      end if;
    end loop;
  end loop;

  return v_queued;
end;
$function$;

create or replace function public.responses_before_write()
returns trigger
language plpgsql
set search_path = public
as $function$
declare
  v_event_status public.event_status;
  v_candidate_status public.candidate_status;
  v_deadline timestamptz;
begin
  if tg_op = 'UPDATE' then
    new.candidate_id = old.candidate_id;
    new.event_id = old.event_id;
    new.group_id = old.group_id;
    new.user_id = old.user_id;
  else
    select c.event_id, c.group_id, c.status
    into new.event_id, new.group_id, v_candidate_status
    from public.event_candidates c
    where c.id = new.candidate_id;

    if new.group_id is null then
      raise exception 'candidate not found';
    end if;
  end if;

  select e.status, e.response_deadline_at
  into v_event_status, v_deadline
  from public.events e
  where e.id = new.event_id;

  if v_event_status is null then
    raise exception 'event not found';
  end if;

  if v_event_status in ('completed', 'cancelled') then
    raise exception 'this event is no longer open for scheduling changes';
  end if;

  if v_candidate_status is null then
    select c.status into v_candidate_status
    from public.event_candidates c
    where c.id = new.candidate_id;
  end if;

  if v_event_status = 'confirmed' then
    if v_candidate_status is distinct from 'selected' then
      raise exception 'this event is no longer open for scheduling changes';
    end if;
    new.submitted_late := false;
  elsif v_event_status in ('proposing', 'voting', 'awaiting_agreement', 'reopened', 'draft') then
    if v_candidate_status is distinct from 'proposed' then
      raise exception 'this event is no longer open for scheduling changes';
    end if;
    if v_deadline is not null and pg_catalog.now() > v_deadline then
      new.submitted_late := true;
    else
      new.submitted_late := false;
    end if;
  elsif v_deadline is not null and pg_catalog.now() > v_deadline then
    new.submitted_late := true;
  else
    new.submitted_late := false;
  end if;

  if not exists (
    select 1
    from public.group_memberships m
    where m.group_id = new.group_id
      and m.user_id = new.user_id
      and m.status = 'active'
  ) then
    raise exception 'responses require an active group member';
  end if;

  if new.response = 'maybe' and not exists (
    select 1
    from public.group_settings s
    where s.group_id = new.group_id
      and s.maybe_responses_enabled
  ) then
    raise exception 'maybe responses are disabled for this group';
  end if;

  return new;
end;
$function$;

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
        response_deadline_at = null,
        updated_at = pg_catalog.now()
      where e.id = v_event.id
        and e.status = 'proposing';

      if found then
        v_cancelled := v_cancelled + 1;
        perform public.notify_event_recipients_except(
          v_event.id,
          null,
          'event_cancelled'::public.notification_kind,
          'Hui cancelled',
          format(
            'Hui cancelled: %s on %s',
            v_event.title,
            public.event_notification_date_label(v_event.id)
          ),
          'event_cancelled:' || v_event.id::text,
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
