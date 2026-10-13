-- HUI-ONBOARDING-002B: invite preview timezone without client RLS; gathering-focused invites.

drop function if exists public.resolve_group_invite(text);

create or replace function public.resolve_group_invite(
  p_token text,
  p_focus_event_id uuid default null
)
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
  v_event_found boolean := false;
  v_timezone text := 'Pacific/Auckland';
  v_coordination public.event_status[] := array[
    'proposing'::public.event_status,
    'voting'::public.event_status,
    'awaiting_agreement'::public.event_status,
    'reopened'::public.event_status
  ];
begin
  select * into v_row from public._active_group_invite_row(p_token) limit 1;

  if v_row is null then
    return pg_catalog.jsonb_build_object('status', 'invalid');
  end if;

  select coalesce(gs.timezone, 'Pacific/Auckland')
  into v_timezone
  from public.group_settings gs
  where gs.group_id = v_row.group_id;

  select p.display_name
  into v_inviter_name
  from public.group_invite_links l
  left join public.profiles p on p.id = l.created_by
  where l.id = v_row.link_id;

  if p_focus_event_id is not null then
    select
      e.id,
      e.title,
      e.status::text as status,
      e.planning_target_date,
      e.gathering_type::text as gathering_type,
      e.gathering_type_custom
    into v_event
    from public.events e
    where e.id = p_focus_event_id
      and e.group_id = v_row.group_id
      and e.status = any (v_coordination)
    limit 1;
    v_event_found := found;
  end if;

  if not v_event_found then
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
      and e.status = any (v_coordination)
    order by e.created_at desc
    limit 1;
    v_event_found := found;
  end if;

  if v_event_found then
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
      'groupTimeZone',
      v_timezone,
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
    'groupTimeZone',
    v_timezone,
    'inviterDisplayName',
    v_inviter_name,
    'planning',
    v_planning
  );
end;
$function$;

comment on function public.resolve_group_invite(text, uuid) is
  'Public invite preview: group, timezone, optional focus gathering, and active planning context.';

grant execute on function public.resolve_group_invite(text, uuid) to anon, authenticated, service_role;

notify pgrst, 'reload schema';
