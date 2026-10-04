-- HUI-026U.4: accepted host may confirm or change the physical place without full event edit rights.
-- Direct `events` updates remain limited to creators/admins under RLS; hosts use this RPC.

create or replace function public.update_event_place(
  p_event_id uuid,
  p_location text,
  p_location_lat double precision default null,
  p_location_lng double precision default null
)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_user uuid := auth.uid();
  v_group_id uuid;
  v_event_status public.event_status;
  v_location text;
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

  if v_event_status not in ('proposing', 'confirmed') then
    raise exception 'place can only be updated while the event is open for coordination';
  end if;

  if not exists (
    select 1
    from public.host_assignments ha
    where ha.event_id = p_event_id
      and ha.user_id = v_user
      and ha.status = 'accepted'
  ) then
    raise exception 'only the accepted host can update the place for this hui';
  end if;

  if p_location is not null then
    v_location := pg_catalog.btrim(p_location);
    if v_location = '' then
      v_location := null;
    elsif pg_catalog.char_length(v_location) > 200 then
      raise exception 'location is too long';
    end if;
  else
    v_location := null;
  end if;

  if (p_location_lat is null) <> (p_location_lng is null) then
    raise exception 'enter a valid map location';
  end if;
  if p_location_lat is not null and (
       p_location_lat < -90 or p_location_lat > 90
       or p_location_lng < -180 or p_location_lng > 180
     ) then
    raise exception 'enter a valid map location';
  end if;

  update public.events e
  set
    location = v_location,
    location_lat = p_location_lat,
    location_lng = p_location_lng
  where e.id = p_event_id;
end;
$function$;

comment on function public.update_event_place(uuid, text, double precision, double precision) is
  'Lets the accepted host set or change location text and optional WGS84 coordinates during proposing or confirmed coordination.';

revoke all on function public.update_event_place(uuid, text, double precision, double precision)
  from public, anon;

grant execute on function public.update_event_place(uuid, text, double precision, double precision)
  to authenticated, service_role;
