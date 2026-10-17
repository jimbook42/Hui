-- v0.18.17: Web Push to accepted host (or organiser) on What to bring claim/release.
-- In-app coordination notifications unchanged. Not applied to production without Isaac's OK.

drop function if exists public.notify_contribution_coordination(uuid, uuid, text, text);

create or replace function public.notify_contribution_coordination(
  p_event_id uuid,
  p_actor_id uuid,
  p_dedupe_key text,
  p_body text,
  p_push_host_on_claim_release boolean default false
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_group_id uuid;
  v_recipient uuid;
  v_push_recipient uuid;
  v_deliver_push boolean;
  v_rate_limited boolean;
begin
  select e.group_id into v_group_id from public.events e where e.id = p_event_id;
  if v_group_id is null then
    return;
  end if;

  if p_push_host_on_claim_release then
    v_push_recipient := coalesce(
      public.event_accepted_host_user_id(p_event_id),
      (select e.created_by from public.events e where e.id = p_event_id)
    );
    v_rate_limited := public.contribution_event_push_recently(p_event_id);
  else
    v_push_recipient := null;
    v_rate_limited := true;
  end if;

  for v_recipient in
    select public.contribution_coordination_recipient_ids(p_event_id, p_actor_id)
  loop
    v_deliver_push :=
      p_push_host_on_claim_release
      and v_push_recipient is not null
      and v_recipient = v_push_recipient
      and v_recipient is distinct from p_actor_id
      and not v_rate_limited;

    perform public.queue_member_notification(
      v_recipient,
      'contribution_changed'::public.notification_kind,
      'Contribution updated',
      p_body,
      v_group_id,
      p_event_id,
      p_dedupe_key || ':coord:' || v_recipient::text,
      v_deliver_push
    );
  end loop;

  if
    p_push_host_on_claim_release
    and v_push_recipient is not null
    and v_push_recipient is distinct from p_actor_id
    and not v_rate_limited
    and not exists (
      select 1
      from public.contribution_coordination_recipient_ids(p_event_id, p_actor_id) r
      where r = v_push_recipient
    )
  then
    perform public.queue_member_notification(
      v_push_recipient,
      'contribution_changed'::public.notification_kind,
      'Contribution updated',
      p_body,
      v_group_id,
      p_event_id,
      p_dedupe_key || ':push:' || v_push_recipient::text,
      true
    );
  end if;
end;
$function$;

comment on function public.notify_contribution_coordination(uuid, uuid, text, text, boolean) is
  'Notify organisers in-app on contribution coordination; optional Web Push to accepted host or event creator on claim/release.';

create or replace function public.notify_contribution_member_claim(
  p_event_id uuid,
  p_actor_id uuid,
  p_contribution_id uuid,
  p_label text
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_event_title text;
  v_group_name text;
  v_actor_name text;
  v_body text;
begin
  select e.title, g.name
  into v_event_title, v_group_name
  from public.events e
  join public.groups g on g.id = e.group_id
  where e.id = p_event_id;

  v_actor_name := public._contribution_actor_display_name(p_actor_id);
  v_body := pg_catalog.format(
    '%s claimed "%s" on "%s" in %s.',
    v_actor_name,
    coalesce(p_label, 'a contribution'),
    coalesce(v_event_title, 'an event'),
    coalesce(v_group_name, 'your group')
  );

  perform public.notify_contribution_coordination(
    p_event_id,
    p_actor_id,
    'contrib:claim:' || p_contribution_id::text,
    v_body,
    true
  );
end;
$function$;

create or replace function public.notify_contribution_release(
  p_event_id uuid,
  p_actor_id uuid,
  p_contribution_id uuid,
  p_label text
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_event_title text;
  v_group_name text;
  v_actor_name text;
  v_body text;
begin
  select e.title, g.name
  into v_event_title, v_group_name
  from public.events e
  join public.groups g on g.id = e.group_id
  where e.id = p_event_id;

  v_actor_name := public._contribution_actor_display_name(p_actor_id);
  v_body := pg_catalog.format(
    '%s released "%s" on "%s" in %s.',
    v_actor_name,
    coalesce(p_label, 'a contribution'),
    coalesce(v_event_title, 'an event'),
    coalesce(v_group_name, 'your group')
  );

  perform public.notify_contribution_coordination(
    p_event_id,
    p_actor_id,
    'contrib:release:' || p_contribution_id::text,
    v_body,
    true
  );
end;
$function$;

revoke all on function public.notify_contribution_coordination(uuid, uuid, text, text, boolean)
  from public, anon, authenticated;
