-- HUI-021: in-app member notifications and reconnect reminders.

create type public.notification_kind as enum (
  'event_proposed',
  'consensus_ready',
  'event_confirmed',
  'host_proposed',
  'host_accepted',
  'host_declined',
  'contribution_changed',
  'reconnect_reminder'
);

alter table public.profiles
  add column if not exists member_reconnect_reminders_enabled boolean not null default true;

comment on column public.profiles.member_reconnect_reminders_enabled is
  'When false, the member opts out of optional group reconnect reminder notifications.';

create table public.member_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind public.notification_kind not null,
  title text not null,
  body text not null,
  group_id uuid not null references public.groups (id) on delete cascade,
  event_id uuid references public.events (id) on delete cascade,
  dedupe_key text not null,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  constraint member_notifications_title_length check (char_length(title) between 1 and 120),
  constraint member_notifications_body_length check (char_length(body) between 1 and 500),
  constraint member_notifications_user_dedupe unique (user_id, dedupe_key)
);

create index member_notifications_user_unread_idx
  on public.member_notifications (user_id, created_at desc)
  where read_at is null;

create index member_notifications_user_created_idx
  on public.member_notifications (user_id, created_at desc);

comment on table public.member_notifications is
  'In-app notifications for one member. Created only through SECURITY DEFINER helpers.';

create or replace function public.queue_member_notification(
  p_user_id uuid,
  p_kind public.notification_kind,
  p_title text,
  p_body text,
  p_group_id uuid,
  p_event_id uuid,
  p_dedupe_key text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_id uuid;
begin
  if p_user_id is null or p_group_id is null or p_dedupe_key is null then
    return null;
  end if;

  if char_length(btrim(coalesce(p_title, ''))) < 1
     or char_length(btrim(coalesce(p_body, ''))) < 1 then
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
    btrim(p_title),
    btrim(p_body),
    p_group_id,
    p_event_id,
    p_dedupe_key
  )
  on conflict (user_id, dedupe_key) do nothing
  returning id into v_id;

  return v_id;
end;
$function$;

comment on function public.queue_member_notification(uuid, public.notification_kind, text, text, uuid, uuid, text) is
  'Idempotently enqueue one in-app notification for an active group member.';

create or replace function public.notify_group_members_except(
  p_group_id uuid,
  p_except_user_id uuid,
  p_kind public.notification_kind,
  p_title text,
  p_body text,
  p_event_id uuid,
  p_dedupe_prefix text
)
returns integer
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_member uuid;
  v_count integer := 0;
begin
  for v_member in
    select m.user_id
    from public.group_memberships m
    where m.group_id = p_group_id
      and m.status = 'active'
      and (p_except_user_id is null or m.user_id is distinct from p_except_user_id)
  loop
    if public.queue_member_notification(
      v_member,
      p_kind,
      p_title,
      p_body,
      p_group_id,
      p_event_id,
      p_dedupe_prefix || ':' || v_member::text
    ) is not null then
      v_count := v_count + 1;
    end if;
  end loop;

  return v_count;
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
  end if;

  return new;
end;
$function$;

create trigger events_member_notifications
  after insert or update of status on public.events
  for each row execute function public.trg_events_member_notifications();

create or replace function public.trg_event_responses_consensus_notifications()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_candidate public.event_candidates%rowtype;
  v_event public.events%rowtype;
  v_group_name text;
  v_result jsonb;
begin
  select c.* into v_candidate
  from public.event_candidates c
  where c.id = new.candidate_id;

  if not found then
    return new;
  end if;

  select e.* into v_event from public.events e where e.id = v_candidate.event_id;

  if v_event.status is distinct from 'proposing' then
    return new;
  end if;

  v_result := public.candidate_consensus(new.candidate_id);
  if coalesce((v_result ->> 'passes')::boolean, false) is not true then
    return new;
  end if;

  select g.name into v_group_name from public.groups g where g.id = v_event.group_id;

  perform public.notify_group_members_except(
    v_event.group_id,
    new.user_id,
    'consensus_ready'::public.notification_kind,
    'Consensus reached',
    format(
      'A time for "%s" in %s now meets the group consensus rules.',
      v_event.title,
      coalesce(v_group_name, 'your group')
    ),
    v_event.id,
    'consensus_ready:' || v_candidate.id::text
  );

  return new;
end;
$function$;

create trigger event_responses_consensus_notifications
  after insert or update of response on public.event_responses
  for each row execute function public.trg_event_responses_consensus_notifications();

create or replace function public.trg_host_assignments_notifications()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_event_title text;
  v_group_name text;
begin
  select e.title, g.name
  into v_event_title, v_group_name
  from public.events e
  join public.groups g on g.id = e.group_id
  where e.id = new.event_id;

  if tg_op = 'INSERT' then
    if new.status = 'proposed' and new.user_id is not null then
      perform public.queue_member_notification(
        new.user_id,
        'host_proposed'::public.notification_kind,
        'Host request',
        format(
          'You have been asked to host "%s" in %s.',
          coalesce(v_event_title, 'an event'),
          coalesce(v_group_name, 'your group')
        ),
        new.group_id,
        new.event_id,
        'host_proposed:' || new.id::text
      );
    elsif new.status = 'accepted'
      and new.user_id is not null
      and new.user_id is distinct from new.assigned_by then
      perform public.queue_member_notification(
        new.user_id,
        'host_accepted'::public.notification_kind,
        'You are hosting',
        format(
          'You are now listed as host for "%s" in %s.',
          coalesce(v_event_title, 'an event'),
          coalesce(v_group_name, 'your group')
        ),
        new.group_id,
        new.event_id,
        'host_accepted:' || new.id::text
      );
    end if;
  elsif tg_op = 'UPDATE'
    and old.status = 'proposed'
    and new.status in ('accepted', 'declined')
    and new.assigned_by is not null
    and new.assigned_by is distinct from new.user_id then
    perform public.queue_member_notification(
      new.assigned_by,
      case
        when new.status = 'accepted' then 'host_accepted'::public.notification_kind
        else 'host_declined'::public.notification_kind
      end,
      case
        when new.status = 'accepted' then 'Host accepted'
        else 'Host declined'
      end,
      case
        when new.status = 'accepted' then format(
          'Your host proposal for "%s" was accepted.',
          coalesce(v_event_title, 'the event')
        )
        else format(
          'Your host proposal for "%s" was declined.',
          coalesce(v_event_title, 'the event')
        )
      end,
      new.group_id,
      new.event_id,
      'host_response:' || new.id::text || ':' || new.status::text
    );
  end if;

  return new;
end;
$function$;

create trigger host_assignments_notifications
  after insert or update of status on public.host_assignments
  for each row execute function public.trg_host_assignments_notifications();

create or replace function public.trg_event_contributions_notifications()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_event_title text;
  v_group_name text;
  v_actor uuid;
begin
  if tg_op = 'DELETE' and old.status = 'accepted' then
    v_actor := old.user_id;
    select e.title, g.name
    into v_event_title, v_group_name
    from public.events e
    join public.groups g on g.id = e.group_id
    where e.id = old.event_id;

    perform public.notify_group_members_except(
      old.group_id,
      v_actor,
      'contribution_changed'::public.notification_kind,
      'Contribution updated',
      format(
        'A contribution slot changed on "%s" in %s.',
        coalesce(v_event_title, 'an event'),
        coalesce(v_group_name, 'your group')
      ),
      old.event_id,
      'contribution_released:' || old.id::text
    );
  elsif tg_op = 'INSERT' and new.status = 'accepted' then
    select e.title, g.name
    into v_event_title, v_group_name
    from public.events e
    join public.groups g on g.id = e.group_id
    where e.id = new.event_id;

    perform public.notify_group_members_except(
      new.group_id,
      new.user_id,
      'contribution_changed'::public.notification_kind,
      'Contribution updated',
      format(
        'A contribution was claimed on "%s" in %s.',
        coalesce(v_event_title, 'an event'),
        coalesce(v_group_name, 'your group')
      ),
      new.event_id,
      'contribution_claimed:' || new.id::text
    );
  end if;

  return coalesce(new, old);
end;
$function$;

create trigger event_contributions_notifications
  after insert or delete on public.event_contributions
  for each row execute function public.trg_event_contributions_notifications();

create or replace function public.sync_reconnect_reminders_for_member()
returns integer
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_user uuid := auth.uid();
  v_row record;
  v_last_activity timestamptz;
  v_created integer := 0;
  v_id uuid;
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = v_user
      and p.member_reconnect_reminders_enabled
      and p.account_deleted_at is null
  ) then
    return 0;
  end if;

  for v_row in
    select
      g.id as group_id,
      g.name as group_name,
      gs.reconnect_after_days as reconnect_days
    from public.group_memberships m
    join public.groups g on g.id = m.group_id
    join public.group_settings gs on gs.group_id = g.id
    where m.user_id = v_user
      and m.status = 'active'
      and gs.reconnect_reminders_enabled
      and gs.reconnect_after_days is not null
  loop
    select max(greatest(e.updated_at, e.created_at))
    into v_last_activity
    from public.events e
    where e.group_id = v_row.group_id
      and e.status <> 'cancelled';

    if v_last_activity is null then
      select g.created_at into v_last_activity
      from public.groups g
      where g.id = v_row.group_id;
    end if;

    if v_last_activity is null then
      continue;
    end if;

    if v_last_activity > now() - make_interval(days => v_row.reconnect_days) then
      continue;
    end if;

    v_id := public.queue_member_notification(
      v_user,
      'reconnect_reminder'::public.notification_kind,
      'Reconnect with your group',
      format(
        '%s has been quiet for a while. Open the group when you are ready to plan again.',
        coalesce(v_row.group_name, 'Your group')
      ),
      v_row.group_id,
      null,
      'reconnect:' || v_row.group_id::text || ':' || to_char(v_last_activity at time zone 'UTC', 'YYYY-MM-DD')
    );

    if v_id is not null then
      v_created := v_created + 1;
    end if;
  end loop;

  return v_created;
end;
$function$;

comment on function public.sync_reconnect_reminders_for_member() is
  'Creates optional reconnect reminder notifications for the caller when a group is inactive per group_settings.';

create or replace function public.mark_notification_read(p_notification_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_user uuid := auth.uid();
  v_updated integer;
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;

  update public.member_notifications n
  set read_at = coalesce(n.read_at, now())
  where n.id = p_notification_id
    and n.user_id = v_user;

  get diagnostics v_updated = row_count;
  if v_updated <> 1 then
    raise exception 'notification not found';
  end if;
end;
$function$;

create or replace function public.mark_all_notifications_read()
returns integer
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_user uuid := auth.uid();
  v_updated integer;
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;

  update public.member_notifications n
  set read_at = now()
  where n.user_id = v_user
    and n.read_at is null;

  get diagnostics v_updated = row_count;
  return v_updated;
end;
$function$;

alter table public.member_notifications enable row level security;
alter table public.member_notifications force row level security;

create policy member_notifications_select_own
  on public.member_notifications
  for select
  to authenticated
  using (user_id = auth.uid());

create policy member_notifications_update_own
  on public.member_notifications
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

revoke all on table public.member_notifications from public, anon;
grant select, update on table public.member_notifications to authenticated;
grant all on table public.member_notifications to service_role;

revoke all on function public.queue_member_notification(uuid, public.notification_kind, text, text, uuid, uuid, text)
  from public, anon, authenticated;
revoke all on function public.notify_group_members_except(uuid, uuid, public.notification_kind, text, text, uuid, text)
  from public, anon, authenticated;

revoke all on function public.sync_reconnect_reminders_for_member() from public, anon;
grant execute on function public.sync_reconnect_reminders_for_member() to authenticated, service_role;

revoke all on function public.mark_notification_read(uuid) from public, anon;
grant execute on function public.mark_notification_read(uuid) to authenticated, service_role;

revoke all on function public.mark_all_notifications_read() from public, anon;
grant execute on function public.mark_all_notifications_read() to authenticated, service_role;

-- Account deletion removes in-app notifications for the member.
create or replace function public.delete_my_account_data()
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_user uuid := auth.uid();
  v_group_id uuid;
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;

  if exists (
    select 1
    from public.profiles p
    where p.id = v_user
      and p.account_deleted_at is not null
  ) then
    return;
  end if;

  if exists (
    select 1
    from public.group_memberships m
    where m.user_id = v_user
      and m.role = 'owner'
      and m.status = 'active'
      and exists (
        select 1
        from public.group_memberships o
        where o.group_id = m.group_id
          and o.status = 'active'
          and o.user_id <> v_user
      )
  ) then
    raise exception 'transfer group ownership before deleting your account';
  end if;

  for v_group_id in
    select g.id
    from public.groups g
    where exists (
      select 1
      from public.group_memberships m
      where m.group_id = g.id
        and m.user_id = v_user
        and m.status = 'active'
    )
    and not exists (
      select 1
      from public.group_memberships o
      where o.group_id = g.id
        and o.status = 'active'
        and o.user_id <> v_user
    )
  loop
    perform public._delete_group_cascade(v_group_id);
  end loop;

  delete from public.member_notifications where user_id = v_user;
  delete from public.dietary_entries where user_id = v_user;

  delete from public.event_responses
  where user_id = v_user
    and visibility = 'private';

  delete from public.household_members where user_id = v_user;

  update public.group_memberships
  set status = 'removed'
  where user_id = v_user
    and status = 'active';

  update public.profiles
  set display_name = 'Former member',
      account_deleted_at = now()
  where id = v_user;
end;
$function$;
