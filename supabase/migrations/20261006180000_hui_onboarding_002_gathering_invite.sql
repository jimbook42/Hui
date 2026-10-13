-- HUI-ONBOARDING-002: gathering context on events + richer invite preview.

create type public.gathering_type as enum (
  'dinner_meal',
  'golf',
  'drinks_night_out',
  'game_night',
  'trip_outing',
  'meeting',
  'other'
);

alter table public.events
  add column if not exists gathering_type public.gathering_type,
  add column if not exists gathering_type_custom text;

alter table public.events
  add constraint events_gathering_type_custom_length check (
    gathering_type_custom is null
    or char_length(gathering_type_custom) between 1 and 80
  ),
  add constraint events_gathering_type_custom_required check (
    gathering_type is null
    or gathering_type <> 'other'
    or (
      gathering_type_custom is not null
      and char_length(btrim(gathering_type_custom)) >= 1
    )
  );

comment on column public.events.gathering_type is
  'Lightweight gathering category for invitations and summaries — not a workflow taxonomy.';
comment on column public.events.gathering_type_custom is
  'When gathering_type is other, a short human description.';

create or replace function public.resolve_group_invite(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_user uuid := auth.uid();
  v_row record;
  v_inviter_name text;
  v_planning jsonb := null;
  v_event record;
begin
  select * into v_row from public._active_group_invite_row(p_token) limit 1;

  if v_row is null then
    return pg_catalog.jsonb_build_object('status', 'invalid');
  end if;

  select p.display_name
  into v_inviter_name
  from public.group_invite_links l
  left join public.profiles p on p.id = l.created_by
  where l.id = v_row.link_id;

  select
    e.id,
    e.title,
    e.status::text as status,
    e.planning_target_date,
    e.gathering_type::text as gathering_type,
    e.gathering_type_custom
  into v_event
  from public.events e
  where e.group_id = v_row.group_id
    and e.status in (
      'proposing'::public.event_status,
      'voting'::public.event_status,
      'awaiting_agreement'::public.event_status,
      'reopened'::public.event_status
    )
  order by e.created_at desc
  limit 1;

  if v_event.id is not null then
    v_planning := pg_catalog.jsonb_build_object(
      'eventId',
      v_event.id,
      'eventTitle',
      v_event.title,
      'status',
      v_event.status,
      'planningTargetDate',
      v_event.planning_target_date,
      'gatheringType',
      v_event.gathering_type,
      'gatheringTypeCustom',
      v_event.gathering_type_custom
    );
  end if;

  if v_user is not null and public.is_active_member(v_row.group_id) then
    return pg_catalog.jsonb_build_object(
      'status',
      'already_member',
      'groupId',
      v_row.group_id,
      'groupName',
      v_row.group_name,
      'inviterDisplayName',
      v_inviter_name,
      'planning',
      v_planning
    );
  end if;

  return pg_catalog.jsonb_build_object(
    'status',
    'valid',
    'groupId',
    v_row.group_id,
    'groupName',
    v_row.group_name,
    'inviterDisplayName',
    v_inviter_name,
    'planning',
    v_planning
  );
end;
$function$;

comment on function public.resolve_group_invite(text) is
  'Public invite preview: group + optional active planning hui context; no data for invalid tokens.';
