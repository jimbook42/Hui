-- v0.18.18: notify members who already answered when a new proposed time is added;
-- fix member release to reopen contribution slots (not delete rows).
-- Not applied to production without Isaac's OK.

do $$
begin
  alter type public.notification_kind add value 'new_proposed_time';
exception
  when duplicate_object then null;
end
$$;

create or replace function public.new_proposed_time_notify_bucket(p_at timestamptz default pg_catalog.now())
returns text
language plpgsql
stable
set search_path = ''
as $function$
begin
  return ((pg_catalog.date_part('epoch', p_at)::bigint / 900)::text);
end;
$function$;

comment on function public.new_proposed_time_notify_bucket(timestamptz) is
  '15-minute dedupe bucket for new proposed time alerts (one alert per member per burst).';

create or replace function public.notify_new_proposed_time(
  p_event_id uuid,
  p_actor_id uuid,
  p_candidate_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_event public.events%rowtype;
  v_group_name text;
  v_body text;
  v_title text := 'New time to consider';
  v_member uuid;
  v_bucket text;
  v_dedupe text;
begin
  if p_event_id is null or p_actor_id is null then
    return;
  end if;

  select * into v_event
  from public.events e
  where e.id = p_event_id;

  if not found then
    return;
  end if;

  if v_event.status in ('confirmed', 'cancelled', 'completed') then
    return;
  end if;

  select g.name into v_group_name
  from public.groups g
  where g.id = v_event.group_id;

  v_body := pg_catalog.format(
    'A new time was added to "%s" in %s. Your earlier answers are still saved — please check the new time.',
    coalesce(v_event.title, 'your hui'),
    coalesce(v_group_name, 'your group')
  );

  v_bucket := public.new_proposed_time_notify_bucket(pg_catalog.now());

  for v_member in
    select distinct er.user_id
    from public.event_responses er
    inner join public.event_candidates c on c.id = er.candidate_id
    where c.event_id = p_event_id
      and c.status = 'proposed'
      and c.id is distinct from p_candidate_id
      and er.user_id is distinct from p_actor_id
  loop
    v_dedupe :=
      'new_proposed_time:' || p_event_id::text || ':' || v_member::text || ':' || v_bucket;

    perform public.queue_member_notification(
      v_member,
      'new_proposed_time'::public.notification_kind,
      v_title,
      v_body,
      v_event.group_id,
      p_event_id,
      v_dedupe,
      true
    );
  end loop;
end;
$function$;

comment on function public.notify_new_proposed_time(uuid, uuid, uuid) is
  'In-app alert + push for members who already answered when another proposed time is added. Skips actor and non-responders.';

revoke all on function public.notify_new_proposed_time(uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.notify_new_proposed_time(uuid, uuid, uuid) to authenticated, service_role;

create or replace function public.trg_notify_new_proposed_time()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if new.status is distinct from 'proposed' then
    return new;
  end if;

  perform public.notify_new_proposed_time(
    new.event_id,
    coalesce(new.proposed_by, auth.uid()),
    new.id
  );

  return new;
end;
$function$;

drop trigger if exists event_candidates_notify_new_proposed_time on public.event_candidates;

create trigger event_candidates_notify_new_proposed_time
  after insert on public.event_candidates
  for each row
  execute function public.trg_notify_new_proposed_time();

drop function if exists public.queue_member_notification(
  uuid,
  public.notification_kind,
  text,
  text,
  uuid,
  uuid,
  text,
  boolean
);

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
      when 'new_proposed_time' then p.push_event_proposals_enabled
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

create or replace function public.release_event_contribution(p_contribution_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user uuid := auth.uid();
  v_event_id uuid;
  v_label text;
  v_category_name text;
  v_follows_host boolean;
  v_updated integer;
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;

  select ec.event_id, ec.label, c.name, c.follows_host
  into v_event_id, v_label, v_category_name, v_follows_host
  from public.event_contributions ec
  join public.events e on e.id = ec.event_id
  join public.contribution_categories c on c.id = ec.category_id
  where ec.id = p_contribution_id
    and ec.user_id = v_user
    and ec.status = 'accepted'
    and e.status not in ('cancelled', 'completed');

  if v_event_id is null then
    raise exception 'contribution not found or cannot be released';
  end if;

  if coalesce(v_follows_host, false) then
    raise exception 'this category follows the host and cannot be released manually';
  end if;

  update public.event_contributions ec
  set
    user_id = null,
    status = 'open'::public.contribution_status,
    assigned_by = null,
    label = coalesce(v_category_name, ec.label)
  where ec.id = p_contribution_id
    and ec.user_id = v_user
    and ec.status = 'accepted'::public.contribution_status
    and exists (
      select 1
      from public.events e
      where e.id = ec.event_id
        and e.status not in ('cancelled', 'completed')
    );

  get diagnostics v_updated = row_count;
  if v_updated <> 1 then
    raise exception 'contribution not found or cannot be released';
  end if;

  perform public.notify_contribution_release(
    v_event_id,
    v_user,
    p_contribution_id,
    coalesce(v_label, v_category_name)
  );
end;
$function$;

comment on function public.release_event_contribution(uuid) is
  'Contribution owner clears their claim and reopens the slot for others.';
