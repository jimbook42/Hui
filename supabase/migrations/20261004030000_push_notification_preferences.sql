-- HUI-024: per-notification-type Web Push preferences.
-- In-app notifications remain canonical; these settings only gate new push outbox rows.

alter table public.profiles
  add column if not exists push_event_proposals_enabled boolean not null default true,
  add column if not exists push_consensus_ready_enabled boolean not null default true,
  add column if not exists push_event_confirmed_enabled boolean not null default true,
  add column if not exists push_host_assignment_enabled boolean not null default true,
  add column if not exists push_contribution_changes_enabled boolean not null default true;

comment on column public.profiles.push_event_proposals_enabled is
  'Whether event proposal notifications may be queued for Web Push.';
comment on column public.profiles.push_consensus_ready_enabled is
  'Whether decision-ready notifications may be queued for Web Push.';
comment on column public.profiles.push_event_confirmed_enabled is
  'Whether event confirmation notifications may be queued for Web Push.';
comment on column public.profiles.push_host_assignment_enabled is
  'Whether host assignment notifications may be queued for Web Push.';
comment on column public.profiles.push_contribution_changes_enabled is
  'Whether contribution change notifications may be queued for Web Push.';

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

  if v_id is not null then
    select case p_kind
      when 'event_proposed' then p.push_event_proposals_enabled
      when 'consensus_ready' then p.push_consensus_ready_enabled
      when 'event_confirmed' then p.push_event_confirmed_enabled
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

comment on function public.queue_member_notification(uuid, public.notification_kind, text, text, uuid, uuid, text) is
  'Idempotently enqueue one in-app notification and, when its Web Push preference is enabled, a matching outbox row.';

revoke all on function public.queue_member_notification(uuid, public.notification_kind, text, text, uuid, uuid, text)
  from public, anon, authenticated;
