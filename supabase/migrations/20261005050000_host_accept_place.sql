-- HUI-026U.4: optional per-event flag that the accepted host must set/confirm the place when accepting.

alter table public.events
  add column if not exists host_place_required boolean;

comment on column public.events.host_place_required is
  'When true and the group uses hosting, accepting a host proposal requires setting or confirming event location. Null or false keeps acceptance frictionless.';

drop function if exists public.respond_to_host_assignment(uuid, boolean);

create or replace function public.respond_to_host_assignment(
  p_event_id uuid,
  p_accept boolean,
  p_location text default null,
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
  v_assignment_id uuid;
  v_updated integer;
  v_hosting_enabled boolean;
  v_place_required boolean;
  v_location text;
  v_has_place boolean;
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;

  select e.group_id, e.status, e.host_place_required
  into v_group_id, v_event_status, v_place_required
  from public.events e
  where e.id = p_event_id;

  if v_group_id is null then
    raise exception 'event not found';
  end if;

  if not public.is_active_member(v_group_id) then
    raise exception 'not an active group member';
  end if;

  select gs.hosting_enabled
  into v_hosting_enabled
  from public.group_settings gs
  where gs.group_id = v_group_id;

  if v_hosting_enabled is null then
    v_hosting_enabled := false;
  end if;

  if v_event_status = 'cancelled' then
    raise exception 'host assignment is closed for cancelled events';
  end if;

  if v_event_status not in ('proposing', 'confirmed') then
    raise exception 'host responses are only available while the event is open for coordination';
  end if;

  select ha.id
  into v_assignment_id
  from public.host_assignments ha
  where ha.event_id = p_event_id
    and ha.user_id = v_user
    and ha.status = 'proposed'
  order by ha.created_at desc
  limit 1;

  if v_assignment_id is null then
    raise exception 'no pending host proposal for you on this event';
  end if;

  if p_accept then
    if v_hosting_enabled and coalesce(v_place_required, false) then
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

      v_has_place := v_location is not null
        or (p_location_lat is not null and p_location_lng is not null);

      if not v_has_place then
        raise exception 'confirm where this hui happens before accepting hosting';
      end if;

      update public.events e
      set
        location = v_location,
        location_lat = p_location_lat,
        location_lng = p_location_lng
      where e.id = p_event_id;
    end if;

    update public.host_assignments ha
    set status = 'swapped_out'
    where ha.event_id = p_event_id
      and ha.status = 'accepted';

    update public.host_assignments ha
    set status = 'accepted',
        responded_at = now()
    where ha.id = v_assignment_id
      and ha.user_id = v_user
      and ha.status = 'proposed';

    get diagnostics v_updated = row_count;
    if v_updated <> 1 then
      raise exception 'host acceptance failed';
    end if;

    perform public.sync_host_bound_contributions(p_event_id);
  else
    update public.host_assignments ha
    set status = 'declined',
        responded_at = now()
    where ha.id = v_assignment_id
      and ha.user_id = v_user
      and ha.status = 'proposed';

    get diagnostics v_updated = row_count;
    if v_updated <> 1 then
      raise exception 'host decline failed';
    end if;

    update public.events e
    set creator_initial_host_user_id = null
    where e.id = p_event_id
      and e.creator_initial_host_user_id = v_user;

    perform public.coordinate_event_host_after_attendance(p_event_id, v_user);
  end if;
end;
$function$;

comment on function public.respond_to_host_assignment(uuid, boolean, text, double precision, double precision) is
  'Accept or decline a proposed host assignment. When hosting is enabled and the event requires it, acceptance also sets/confirms event location.';

revoke all on function public.respond_to_host_assignment(uuid, boolean, text, double precision, double precision)
  from public, anon;

grant execute on function public.respond_to_host_assignment(uuid, boolean, text, double precision, double precision)
  to authenticated, service_role;
