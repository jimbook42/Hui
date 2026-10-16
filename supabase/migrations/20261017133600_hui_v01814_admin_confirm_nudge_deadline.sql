-- v0.18.14: admin time pick, optional proposal reply-by, availability nudge rate limit.

do $enum$
begin
  alter type public.event_confirmation_method add value 'admin';
exception
  when duplicate_object then null;
end
$enum$;

do $enum$
begin
  alter type public.notification_kind add value 'availability_nudge';
exception
  when duplicate_object then null;
end
$enum$;

alter table public.events
  add column if not exists last_availability_nudge_at timestamptz;

comment on column public.events.last_availability_nudge_at is
  'When an organiser or host last sent a manual availability nudge (max once per 24h per hui).';

drop trigger if exists events_set_response_deadline on public.events;

drop function if exists public.apply_event_confirmation(uuid, uuid, uuid, boolean);

create or replace function public.apply_event_confirmation(
  p_event_id uuid,
  p_candidate_id uuid,
  p_actor uuid,
  p_force boolean default false,
  p_confirmation_method public.event_confirmation_method default null
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
  v_passes boolean;
  v_yes integer;
  v_method public.event_confirmation_method;
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
  v_passes := coalesce((v_result ->> 'passes')::boolean, false);
  v_yes := coalesce((v_result ->> 'yes_count')::integer, 0);

  if public.host_yes_required_for_candidate(p_event_id, p_candidate_id) then
    return false;
  end if;

  if p_confirmation_method = 'admin'::public.event_confirmation_method then
    v_method := 'admin';
  elsif not v_passes then
    if v_event.confirm_rule = 'organiser_picks'::public.event_confirm_rule then
      if v_yes < 1 then
        return false;
      end if;
      v_method := 'organiser';
    elsif coalesce(p_force, false) is not true then
      return false;
    elsif v_yes < 1 then
      return false;
    else
      v_method := 'organiser';
    end if;
  else
    v_method := 'consensus';
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
    confirmation_method = v_method,
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

comment on function public.apply_event_confirmation(uuid, uuid, uuid, boolean, public.event_confirmation_method) is
  'Confirm a proposing event. p_force skips consensus when at least one yes. p_confirmation_method=admin skips consensus (group admin only via admin_finalise_event). Host Yes is never bypassed.';

create or replace function public.admin_finalise_event(
  p_event_id uuid,
  p_candidate_id uuid
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

  if not public.is_group_admin(v_event.group_id) then
    raise exception 'only group admins can pick a different time';
  end if;

  if v_candidate.event_id is distinct from v_event.id
     or v_candidate.group_id is distinct from v_event.group_id
  then
    raise exception 'candidate not found';
  end if;

  if v_event.status is distinct from 'proposing' then
    raise exception 'only a proposing hui can have its time picked';
  end if;

  if v_candidate.status = 'withdrawn' then
    raise exception 'a withdrawn candidate cannot be confirmed';
  end if;

  if v_candidate.status is distinct from 'proposed' then
    raise exception 'this candidate cannot be confirmed';
  end if;

  if public.host_yes_required_for_candidate(p_event_id, p_candidate_id) then
    raise exception 'waiting on the host to say yes to this time';
  end if;

  perform set_config('hui.event_confirmed_notify_all', '0', true);
  if not public.apply_event_confirmation(
    p_event_id,
    p_candidate_id,
    v_actor,
    false,
    'admin'::public.event_confirmation_method
  ) then
    raise exception 'could not confirm this time';
  end if;
  perform set_config('hui.event_confirmed_notify_all', '', true);
end;
$function$;

comment on function public.admin_finalise_event(uuid, uuid) is
  'Group admin confirms a proposing hui on a chosen candidate, overriding consensus/auto-confirm. Host must have said Yes on that time.';

revoke all on function public.admin_finalise_event(uuid, uuid) from public, anon;
grant execute on function public.admin_finalise_event(uuid, uuid) to authenticated, service_role;

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
  v_host uuid;
begin
  if v_actor is null then
    raise exception 'not authenticated';
  end if;

  select * into v_event from public.events where id = p_event_id;
  if not found or not public.is_active_member(v_event.group_id) then
    raise exception 'event not found';
  end if;
  if v_event.status not in ('proposing', 'voting', 'awaiting_agreement', 'reopened', 'draft') then
    raise exception 'deadline can only be set while planning';
  end if;

  v_host := public.event_accepted_host_user_id(p_event_id);

  if not (
    public.is_group_admin(v_event.group_id)
    or v_event.created_by = v_actor
    or v_host is not distinct from v_actor
  ) then
    raise exception 'not allowed';
  end if;

  update public.events
  set
    response_deadline_at = p_deadline_at,
    updated_at = pg_catalog.now()
  where id = p_event_id;
end;
$function$;

create or replace function public.nudge_event_availability(p_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_event public.events%rowtype;
  v_host uuid;
  v_queued integer := 0;
  v_member uuid;
  v_title text := 'Your answer is needed';
  v_body text;
  v_next timestamptz;
begin
  if v_actor is null then
    raise exception 'not authenticated';
  end if;

  select * into v_event
  from public.events
  where id = p_event_id
  for update;

  if not found or not public.is_active_member(v_event.group_id) then
    raise exception 'event not found';
  end if;

  if v_event.status is distinct from 'proposing' then
    raise exception 'nudges are only available while picking a time';
  end if;

  v_host := public.event_accepted_host_user_id(p_event_id);

  if not (
    public.is_group_admin(v_event.group_id)
    or v_event.created_by = v_actor
    or v_host is not distinct from v_actor
  ) then
    raise exception 'not allowed';
  end if;

  if v_event.last_availability_nudge_at is not null
     and v_event.last_availability_nudge_at > pg_catalog.now() - interval '24 hours'
  then
    v_next := v_event.last_availability_nudge_at + interval '24 hours';
    return jsonb_build_object(
      'queued', 0,
      'rate_limited', true,
      'next_nudge_at', v_next
    );
  end if;

  v_body := format(
    'Please answer the proposed times for "%s".',
    v_event.title
  );

  for v_member in
    select m.user_id
    from public.group_memberships m
    where m.group_id = v_event.group_id
      and m.status = 'active'
      and m.user_id is distinct from v_actor
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
      'availability_nudge'::public.notification_kind,
      v_title,
      v_body,
      v_event.group_id,
      v_event.id,
      'availability_nudge:' || v_event.id::text || ':' || v_member::text || ':' ||
        to_char(pg_catalog.now(), 'YYYYMMDDHH24'),
      false
    ) is not null then
      v_queued := v_queued + 1;
    end if;
  end loop;

  update public.events
  set
    last_availability_nudge_at = pg_catalog.now(),
    updated_at = pg_catalog.now()
  where id = p_event_id;

  v_next := pg_catalog.now() + interval '24 hours';

  return jsonb_build_object(
    'queued', v_queued,
    'rate_limited', false,
    'next_nudge_at', v_next
  );
end;
$function$;

comment on function public.nudge_event_availability(uuid) is
  'Notify active members who have not answered any proposed time. At most once per 24h per hui. Host or admin may send.';

revoke all on function public.nudge_event_availability(uuid) from public, anon;
grant execute on function public.nudge_event_availability(uuid) to authenticated, service_role;

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
      when 'availability_nudge' then p.push_event_proposals_enabled
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
