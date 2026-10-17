-- v0.18.19: self-claim assigned_by null; new_proposed_time preference; queue_member_notification EXECUTE lockdown.

alter table public.profiles
  add column if not exists new_proposed_time_alerts_enabled boolean not null default true;

comment on column public.profiles.new_proposed_time_alerts_enabled is
  'When false, no in-app or push alerts when a new proposed time is added after the member already answered.';

grant select (new_proposed_time_alerts_enabled) on table public.profiles to authenticated;

alter table public.event_contributions
  alter column assigned_by drop not null;

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
    inner join public.profiles p on p.id = er.user_id
      and p.account_deleted_at is null
      and coalesce(p.new_proposed_time_alerts_enabled, true)
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

  if p_kind = 'new_proposed_time'::public.notification_kind then
    if not exists (
      select 1
      from public.profiles p
      where p.id = p_user_id
        and p.account_deleted_at is null
        and coalesce(p.new_proposed_time_alerts_enabled, true)
    ) then
      return null;
    end if;
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
      when 'new_proposed_time' then p.new_proposed_time_alerts_enabled
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

create or replace function public.claim_event_contribution(
  p_event_id uuid,
  p_category_id uuid,
  p_description text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_user uuid := auth.uid();
  v_group_id uuid;
  v_event_status public.event_status;
  v_category_name text;
  v_follows_host boolean;
  v_label text;
  v_contribution_id uuid;
  v_open_id uuid;
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

  if v_event_status = 'cancelled' then
    raise exception 'contributions are closed for cancelled events';
  end if;

  if v_event_status = 'completed' then
    raise exception 'contributions are closed for completed events';
  end if;

  select c.name, c.follows_host
  into v_category_name, v_follows_host
  from public.contribution_categories c
  where c.id = p_category_id
    and c.group_id = v_group_id
    and c.archived_at is null;

  if v_category_name is null then
    raise exception 'contribution category not found or inactive';
  end if;

  if v_follows_host then
    raise exception 'this category follows the host and cannot be claimed manually';
  end if;

  if exists (
    select 1
    from public.event_contributions ec
    where ec.event_id = p_event_id
      and ec.category_id = p_category_id
      and ec.status = 'accepted'
  ) then
    raise exception 'this category is already claimed for the event';
  end if;

  v_label := nullif(trim(coalesce(p_description, '')), '');
  if v_label is null then
    v_label := v_category_name;
  end if;

  if char_length(v_label) < 1 or char_length(v_label) > 160 then
    raise exception 'description must be between 1 and 160 characters when provided';
  end if;

  select ec.id
  into v_open_id
  from public.event_contributions ec
  where ec.event_id = p_event_id
    and ec.category_id = p_category_id
    and ec.status = 'open'
    and ec.user_id is null
  order by ec.created_at asc
  limit 1;

  if v_open_id is not null then
    update public.event_contributions ec
    set
      user_id = v_user,
      label = v_label,
      status = 'accepted',
      assigned_by = null
    where ec.id = v_open_id
    returning ec.id into v_contribution_id;
  else
    insert into public.event_contributions (
      event_id,
      group_id,
      category_id,
      user_id,
      label,
      status,
      assigned_by
    )
    values (
      p_event_id,
      v_group_id,
      p_category_id,
      v_user,
      v_label,
      'accepted',
      null
    )
    returning id into v_contribution_id;
  end if;

  perform public.notify_contribution_member_claim(
    p_event_id,
    v_user,
    v_contribution_id,
    v_label
  );

  return v_contribution_id;
end;
$function$;

comment on function public.claim_event_contribution(uuid, uuid, text) is
  'Member claims an open contribution slot; organiser assignment uses manager RPCs with assigned_by set.';

create or replace function public.contributions_before_write()
returns trigger
language plpgsql
set search_path = public
as $function$
declare
  v_name text;
begin
  if tg_op = 'UPDATE'
     and coalesce(pg_catalog.current_setting('hui.account_deletion', true), '') = '1'
  then
    return new;
  end if;

  if tg_op = 'UPDATE' then
    new.event_id = old.event_id;
    new.group_id = old.group_id;
    if new.user_id is null then
      -- release / reopen: RPC may clear assignee and assigned_by
    elsif old.user_id is null and new.user_id is not null and new.assigned_by is null then
      -- member self-claim from an open slot
    else
      new.assigned_by = old.assigned_by;
    end if;
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

-- Clients must not call queue_member_notification; only SECURITY DEFINER helpers enqueue rows.
revoke all on function public.queue_member_notification(
  uuid,
  public.notification_kind,
  text,
  text,
  uuid,
  uuid,
  text,
  boolean
) from public, anon, authenticated;

grant execute on function public.queue_member_notification(
  uuid,
  public.notification_kind,
  text,
  text,
  uuid,
  uuid,
  text,
  boolean
) to service_role;
