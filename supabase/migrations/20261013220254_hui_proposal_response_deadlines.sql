-- Proposal response deadlines, late responses, reminder cron, reopen notification copy.

do $enum$
begin
  alter type public.notification_kind add value 'proposal_deadline_reminder';
exception
  when duplicate_object then null;
end
$enum$;

alter table public.events
  add column if not exists response_deadline_at timestamptz;

comment on column public.events.response_deadline_at is
  'When members should reply by while the hui is open for scheduling (organiser-editable).';

alter table public.event_responses
  add column if not exists submitted_late boolean not null default false;

comment on column public.event_responses.submitted_late is
  'True when the response was saved after the event response_deadline_at.';

create or replace function public.default_event_response_deadline_at(
  p_group_id uuid,
  p_from timestamptz
)
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select p_from + make_interval(
    hours => coalesce(
      (select gs.proposal_deadline_hours from public.group_settings gs where gs.group_id = p_group_id),
      48
    )::integer
  );
$$;

create or replace function public.events_set_response_deadline()
returns trigger
language plpgsql
set search_path = public
as $function$
begin
  if tg_op = 'INSERT'
     and new.status in ('proposing', 'voting', 'awaiting_agreement', 'reopened', 'draft')
     and new.response_deadline_at is null then
    new.response_deadline_at := public.default_event_response_deadline_at(
      new.group_id,
      coalesce(new.created_at, pg_catalog.now())
    );
  end if;
  return new;
end;
$function$;

drop trigger if exists events_set_response_deadline on public.events;
create trigger events_set_response_deadline
  before insert on public.events
  for each row execute function public.events_set_response_deadline();

update public.events e
set response_deadline_at = public.default_event_response_deadline_at(e.group_id, e.created_at)
where e.status in ('proposing', 'voting', 'awaiting_agreement', 'reopened', 'draft')
  and e.response_deadline_at is null;

create or replace function public.update_event_response_deadline(
  p_event_id uuid,
  p_deadline_at timestamptz
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
  if p_deadline_at is null then
    raise exception 'deadline required';
  end if;

  select * into v_event from public.events where id = p_event_id;
  if not found or not public.is_active_member(v_event.group_id) then
    raise exception 'event not found';
  end if;
  if v_event.status not in ('proposing', 'voting', 'awaiting_agreement', 'reopened', 'draft') then
    raise exception 'deadline can only be set while planning';
  end if;
  if not (
    public.is_group_admin(v_event.group_id)
    or v_event.created_by = v_actor
  ) then
    raise exception 'not allowed';
  end if;

  update public.events
  set response_deadline_at = p_deadline_at, updated_at = pg_catalog.now()
  where id = p_event_id;
end;
$function$;

grant execute on function public.update_event_response_deadline(uuid, timestamptz)
  to authenticated, service_role;

create or replace function public.event_proposal_reply_stats(p_event_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'eligible_member_count', (
      select count(*)::integer
      from public.group_memberships m
      inner join public.events e on e.group_id = m.group_id
      where e.id = p_event_id
        and m.status = 'active'
    ),
    'responded_member_count', (
      select count(distinct er.user_id)::integer
      from public.event_responses er
      inner join public.event_candidates c on c.id = er.candidate_id
      where c.event_id = p_event_id
        and c.status = 'proposed'
    )
  );
$$;

grant execute on function public.event_proposal_reply_stats(uuid) to authenticated, service_role;

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
    where e.status = 'proposing'
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

comment on function public.enqueue_proposal_deadline_reminders(timestamptz) is
  'Daily cron: remind active members without a proposed-time response about 24h before the deadline.';

revoke all on function public.enqueue_proposal_deadline_reminders(timestamptz) from public, anon, authenticated;
grant execute on function public.enqueue_proposal_deadline_reminders(timestamptz) to service_role;

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
    select c.event_id, c.group_id
    into new.event_id, new.group_id
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

  if v_event_status = 'confirmed' then
    select c.status into v_candidate_status
    from public.event_candidates c
    where c.id = new.candidate_id;

    if v_candidate_status is distinct from 'selected' then
      raise exception 'this event is no longer open for scheduling changes';
    end if;
    new.submitted_late := false;
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

create or replace function public.queue_member_notification(
  p_user_id uuid,
  p_kind public.notification_kind,
  p_title text,
  p_body text,
  p_group_id uuid,
  p_event_id uuid,
  p_dedupe_key text,
  p_deliver_push boolean default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_id uuid;
  v_push_enabled boolean;
begin
  if p_user_id is null or p_group_id is null or p_dedupe_key is null then
    return null;
  end if;

  if pg_catalog.char_length(pg_catalog.btrim(coalesce(p_title, ''::text))) < 1
     or pg_catalog.char_length(pg_catalog.btrim(coalesce(p_body, ''::text))) < 1 then
    return null;
  end if;

  if not exists (
    select 1
    from public.group_memberships m
    where m.group_id = p_group_id
      and m.user_id = p_user_id
      and m.status = 'active'
  ) then
    return null;
  end if;

  if p_event_id is not null and not exists (
    select 1
    from public.events e
    where e.id = p_event_id
      and e.group_id = p_group_id
  ) then
    return null;
  end if;

  insert into public.member_notifications (
    user_id,
    kind,
    title,
    body,
    group_id,
    event_id,
    dedupe_key
  )
  values (
    p_user_id,
    p_kind,
    pg_catalog.btrim(p_title),
    pg_catalog.btrim(p_body),
    p_group_id,
    p_event_id,
    p_dedupe_key
  )
  on conflict (user_id, dedupe_key) do nothing
  returning id into v_id;

  if v_id is not null and p_deliver_push is not false then
    select case p_kind
      when 'event_proposed' then p.push_event_proposals_enabled
      when 'consensus_ready' then p.push_consensus_ready_enabled
      when 'event_confirmed' then p.push_event_confirmed_enabled
      when 'event_cancelled' then p.push_event_confirmed_enabled
      when 'event_rescheduled' then p.push_event_confirmed_enabled
      when 'proposal_deadline_reminder' then p.push_event_proposals_enabled
      when 'host_proposed' then p.push_host_assignment_enabled
      when 'host_accepted' then p.push_host_assignment_enabled
      when 'host_declined' then p.push_host_assignment_enabled
      when 'contribution_changed' then p.push_contribution_changes_enabled
      else false
    end
    into v_push_enabled
    from public.profiles p
    where p.id = p_user_id
      and p.account_deleted_at is null;

    if coalesce(v_push_enabled, false) then
      insert into public.notification_push_outbox (notification_id, user_id)
      values (v_id, p_user_id);
    end if;
  end if;

  return v_id;
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
  v_group_name text;
  v_body text;
begin
  v_event := public._assert_can_reschedule_confirmed_event(p_event_id);
  perform set_config('hui.internal_reschedule', '1', true);

  select g.name into v_group_name from public.groups g where g.id = v_event.group_id;

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

  v_body := format(
    '"%s" in %s was reopened for new proposed times. You will be asked again when times are set.',
    v_event.title,
    coalesce(v_group_name, 'your group')
  );

  perform public.notify_event_recipients_except(
    p_event_id,
    v_actor,
    'event_rescheduled'::public.notification_kind,
    'Hui reopened for planning',
    v_body,
    'event_reopened:' || v_audit_id::text,
    true
  );

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
    response_deadline_at = public.default_event_response_deadline_at(v_event.group_id, pg_catalog.now()),
    updated_at = pg_catalog.now()
  where id = p_event_id
    and status = 'confirmed';

  return v_audit_id;
end;
$function$;
