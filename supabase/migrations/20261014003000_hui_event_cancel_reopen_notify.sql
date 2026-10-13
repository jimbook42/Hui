-- Cancel and reopen: in-app notifications for engaged members; idempotent dedupe keys.

do $enum$
begin
  alter type public.notification_kind add value 'event_cancelled';
exception
  when duplicate_object then null;
end
$enum$;

create or replace function public.event_notification_date_label(p_event_id uuid)
returns text
language plpgsql
stable
set search_path = ''
as $function$
declare
  v_event public.events%rowtype;
  v_tz text;
  v_date date;
begin
  select * into v_event from public.events where id = p_event_id;
  if not found then
    return 'TBC';
  end if;

  select coalesce(gs.timezone, v_event.timezone, 'Pacific/Auckland')
  into v_tz
  from public.group_settings gs
  where gs.group_id = v_event.group_id;

  if v_event.starts_at is not null then
    return to_char(v_event.starts_at at time zone v_tz, 'Dy DD Mon YYYY, HH24:MI');
  end if;

  v_date := coalesce(
    v_event.planning_target_date,
    public.proposal_nominal_date_for_event(p_event_id)
  );
  if v_date is not null then
    return to_char(v_date, 'Dy DD Mon YYYY');
  end if;

  return 'TBC';
end;
$function$;

comment on function public.event_notification_date_label(uuid) is
  'Human date label for event lifecycle notification copy (confirmed time or planning nominal).';

create or replace function public.notify_event_recipients_except(
  p_event_id uuid,
  p_except_user_id uuid,
  p_kind public.notification_kind,
  p_title text,
  p_body text,
  p_dedupe_prefix text,
  p_attendees_only boolean default false
)
returns integer
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_group_id uuid;
  v_member uuid;
  v_count integer := 0;
begin
  select e.group_id into v_group_id from public.events e where e.id = p_event_id;
  if v_group_id is null then
    return 0;
  end if;

  for v_member in
    select distinct m.user_id
    from public.group_memberships m
    where m.group_id = v_group_id
      and m.status = 'active'
      and (p_except_user_id is null or m.user_id is distinct from p_except_user_id)
      and (
        not p_attendees_only
        or exists (
          select 1
          from public.event_responses er
          inner join public.event_candidates c on c.id = er.candidate_id
          where c.event_id = p_event_id
            and er.user_id = m.user_id
        )
      )
  loop
    if public.queue_member_notification(
      v_member,
      p_kind,
      p_title,
      p_body,
      v_group_id,
      p_event_id,
      p_dedupe_prefix || ':' || v_member::text
    ) is not null then
      v_count := v_count + 1;
    end if;
  end loop;

  return v_count;
end;
$function$;

comment on function public.notify_event_recipients_except(uuid, uuid, public.notification_kind, text, text, text, boolean) is
  'Notify active group members (or attendees-only) except one user; idempotent per dedupe prefix and member.';

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

create or replace function public.trg_events_member_notifications()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_group_name text;
  v_date_label text;
  v_body text;
begin
  select g.name into v_group_name from public.groups g where g.id = new.group_id;

  if tg_op = 'INSERT' and new.status = 'proposing' then
    perform public.notify_group_members_except(
      new.group_id,
      new.created_by,
      'event_proposed'::public.notification_kind,
      'New event proposal',
      format('"%s" was proposed in %s.', new.title, coalesce(v_group_name, 'your group')),
      new.id,
      'event_proposed:' || new.id::text
    );
  elsif tg_op = 'UPDATE'
    and old.status is distinct from new.status
    and new.status = 'confirmed' then
    perform public.notify_group_members_except(
      new.group_id,
      auth.uid(),
      'event_confirmed'::public.notification_kind,
      'Event confirmed',
      format('"%s" in %s is confirmed.', new.title, coalesce(v_group_name, 'your group')),
      new.id,
      'event_confirmed:' || new.id::text
    );
  elsif tg_op = 'UPDATE'
    and old.status is distinct from 'cancelled'
    and new.status = 'cancelled' then
    v_date_label := public.event_notification_date_label(new.id);
    v_body := format('Hui cancelled: %s on %s', new.title, v_date_label);
    perform public.notify_event_recipients_except(
      new.id,
      auth.uid(),
      'event_cancelled'::public.notification_kind,
      'Hui cancelled',
      v_body,
      'event_cancelled:' || new.id::text,
      false
    );
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
  v_date_label text;
  v_cancel_body text;
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
        v_date_label := public.event_notification_date_label(v_event.id);
        v_cancel_body := format('Hui cancelled: %s on %s', v_event.title, v_date_label);
        perform public.notify_event_recipients_except(
          v_event.id,
          null,
          'event_cancelled'::public.notification_kind,
          'Hui cancelled',
          v_cancel_body,
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

  perform public.notify_event_recipients_except(
    p_event_id,
    v_actor,
    'event_rescheduled'::public.notification_kind,
    'Hui reopened for planning',
    'Times were cleared so new options can be proposed. You will be asked again when times are set.',
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
    updated_at = pg_catalog.now()
  where id = p_event_id
    and status = 'confirmed';

  return v_audit_id;
end;
$function$;
