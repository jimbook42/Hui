-- HUI-COORD QA: reopen notify all members; auto-confirm confirms notify everyone; roster late flag.

create or replace function public.candidate_attendance_roster(p_candidate_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  v_event_id uuid;
  v_group_id uuid;
  v_viewer uuid := auth.uid();
  v_maybe_enabled boolean;
  v_members jsonb := '[]'::jsonb;
  r record;
  v_response text;
  v_submitted_late boolean;
begin
  if v_viewer is null then
    raise exception 'not authenticated';
  end if;

  select c.event_id, c.group_id
  into v_event_id, v_group_id
  from public.event_candidates c
  where c.id = p_candidate_id;

  if v_event_id is null or not public.is_active_member(v_group_id) then
    raise exception 'candidate not found';
  end if;

  select gs.maybe_responses_enabled
  into v_maybe_enabled
  from public.group_settings gs
  where gs.group_id = v_group_id;

  for r in
    select m.user_id, p.display_name
    from public.group_memberships m
    join public.profiles p on p.id = m.user_id
    where m.group_id = v_group_id
      and m.status = 'active'
    order by p.display_name collate "C", m.user_id
  loop
    select er.response::text, er.submitted_late
    into v_response, v_submitted_late
    from public.event_responses er
    where er.candidate_id = p_candidate_id
      and er.user_id = r.user_id;

    v_members := v_members || jsonb_build_array(
      jsonb_build_object(
        'user_id', r.user_id,
        'display_name', r.display_name,
        'response', v_response,
        'submitted_late', coalesce(v_submitted_late, false)
      )
    );
  end loop;

  return jsonb_build_object(
    'maybe_responses_enabled', coalesce(v_maybe_enabled, true),
    'members', v_members
  );
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
  v_except uuid;
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
    v_except := auth.uid();
    if pg_catalog.current_setting('hui.event_confirmed_notify_all', true) = '1' then
      v_except := null;
    end if;
    perform public.notify_group_members_except(
      new.group_id,
      v_except,
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

create or replace function public.try_auto_confirm_event(p_event_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_event public.events%rowtype;
  v_candidate_id uuid;
  v_admin_veto boolean;
  v_ok boolean;
begin
  if pg_catalog.current_setting('hui.skip_auto_confirm', true) = '1' then
    return false;
  end if;

  select * into v_event
  from public.events
  where id = p_event_id
  for update;

  if not found or v_event.status is distinct from 'proposing' then
    return false;
  end if;

  select coalesce(gs.admin_veto_enabled, false)
  into v_admin_veto
  from public.group_settings gs
  where gs.group_id = v_event.group_id;

  if v_admin_veto then
    return false;
  end if;

  v_candidate_id := public.pick_auto_confirm_candidate(p_event_id);
  if v_candidate_id is null then
    return false;
  end if;

  perform set_config('hui.event_confirmed_notify_all', '1', true);
  v_ok := public.apply_event_confirmation(p_event_id, v_candidate_id, v_event.created_by);
  perform set_config('hui.event_confirmed_notify_all', '', true);
  return v_ok;
end;
$function$;

drop function if exists public.finalise_event(uuid, uuid);

create or replace function public.finalise_event(
  p_event_id uuid,
  p_candidate_id uuid,
  p_force boolean default false
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_event public.events%rowtype;
  v_candidate public.event_candidates%rowtype;
  v_result jsonb;
  v_passes boolean;
  v_accepted integer;
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
  v_passes := coalesce((v_result ->> 'passes')::boolean, false);
  v_accepted := coalesce((v_result ->> 'accepted_count')::integer, 0);

  if not v_passes then
    if coalesce(p_force, false) is not true then
      raise exception 'this candidate does not meet the consensus requirements';
    end if;
    if v_accepted < 1 then
      raise exception 'at least one yes is required to confirm this time';
    end if;
  end if;

  perform set_config('hui.event_confirmed_notify_all', '0', true);
  if not public.apply_event_confirmation(p_event_id, p_candidate_id, v_actor) then
    raise exception 'only a proposing event can be confirmed';
  end if;
  perform set_config('hui.event_confirmed_notify_all', '', true);
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

  perform public.notify_group_members_except(
    v_event.group_id,
    v_actor,
    'event_rescheduled'::public.notification_kind,
    'Hui reopened for planning',
    v_body,
    p_event_id,
    'event_reopened:' || v_audit_id::text
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

revoke all on function public.finalise_event(uuid, uuid, boolean) from public, anon;
grant execute on function public.finalise_event(uuid, uuid, boolean) to authenticated, service_role;

comment on function public.finalise_event(uuid, uuid, boolean) is
  'Organiser confirms a proposing event. p_force allows confirm with at least one Yes when consensus is not met (after explicit UI confirm).';
