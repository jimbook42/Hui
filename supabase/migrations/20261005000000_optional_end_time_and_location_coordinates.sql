-- HUI-026U.3: optional event end time + stored event coordinates.
--
-- 1. A proposed time needs a start only. `event_candidates.ends_at` becomes nullable
--    (`events.ends_at` already was). When present it must still be after the start.
--    No fake duration or placeholder end time is ever stored.
-- 2. Events may store Hui's own location coordinates next to the existing `location` text.
--    The coordinates are provider-independent (WGS84 lat/lng); map rendering/tiles are an
--    application concern and never part of the domain model.

alter table public.event_candidates
  alter column ends_at drop not null;

alter table public.event_candidates
  drop constraint if exists event_candidates_time_check;

alter table public.event_candidates
  add constraint event_candidates_time_check
  check (ends_at is null or ends_at > starts_at);

alter table public.events
  add column if not exists location_lat double precision,
  add column if not exists location_lng double precision;

alter table public.events
  drop constraint if exists events_location_coordinates_check;

alter table public.events
  add constraint events_location_coordinates_check
  check (
    (location_lat is null) = (location_lng is null)
    and (
      location_lat is null
      or (
        location_lat between -90 and 90
        and location_lng between -180 and 180
      )
    )
  );

comment on column public.events.location_lat is
  'Optional WGS84 latitude for the event location. Same visibility as the event row (group members).';
comment on column public.events.location_lng is
  'Optional WGS84 longitude for the event location. Set together with location_lat.';

-- Replace the 8-argument signature with one that also accepts optional coordinates.
drop function if exists public.propose_group_event(
  uuid,
  text,
  text,
  text,
  jsonb,
  jsonb,
  boolean,
  uuid
);

create or replace function public.propose_group_event(
  p_group_id uuid,
  p_title text,
  p_location text,
  p_notes text,
  p_recurrence jsonb,
  p_candidates jsonb,
  p_set_initial_host boolean,
  p_initial_host_user_id uuid,
  p_location_lat double precision default null,
  p_location_lng double precision default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_title text;
  v_location text;
  v_notes text;
  v_series_id uuid;
  v_event_id uuid;
  v_candidate jsonb;
  v_starts timestamptz;
  v_ends timestamptz;
  v_count integer;
  v_i integer;
  v_seen text[] := array[]::text[];
  v_key text;
begin
  if v_actor is null then
    raise exception 'not authenticated';
  end if;

  if not public.can_propose_in_group(p_group_id) then
    raise exception 'you cannot propose events in this group';
  end if;

  v_title := pg_catalog.btrim(p_title);
  if pg_catalog.char_length(v_title) < 1 or pg_catalog.char_length(v_title) > 160 then
    raise exception 'enter a valid event title';
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

  if p_notes is not null then
    v_notes := pg_catalog.btrim(p_notes);
    if v_notes = '' then
      v_notes := null;
    elsif pg_catalog.char_length(v_notes) > 2000 then
      raise exception 'notes are too long';
    end if;
  else
    v_notes := null;
  end if;

  v_series_id := null;
  if p_recurrence is not null and p_recurrence <> 'null'::jsonb then
    if not (
      p_recurrence ? 'series_title'
      and p_recurrence ? 'interval_unit'
      and p_recurrence ? 'interval_count'
      and p_recurrence ? 'starts_on'
    ) then
      raise exception 'enter valid recurrence settings';
    end if;

    if pg_catalog.char_length(pg_catalog.btrim(p_recurrence ->> 'series_title')) < 1
       or pg_catalog.char_length(pg_catalog.btrim(p_recurrence ->> 'series_title')) > 160 then
      raise exception 'enter valid recurrence settings';
    end if;

    if (p_recurrence ->> 'interval_unit') not in ('week', 'month') then
      raise exception 'enter valid recurrence settings';
    end if;

    if (p_recurrence ->> 'interval_count')::integer < 1 then
      raise exception 'enter valid recurrence settings';
    end if;

    insert into public.recurrence_series (
      group_id,
      title,
      interval_unit,
      interval_count,
      starts_on,
      created_by
    )
    values (
      p_group_id,
      pg_catalog.btrim(p_recurrence ->> 'series_title'),
      (p_recurrence ->> 'interval_unit')::public.cadence_unit,
      (p_recurrence ->> 'interval_count')::integer,
      (p_recurrence ->> 'starts_on')::date,
      v_actor
    )
    returning id into v_series_id;
  end if;

  if not public.group_allows_event(p_group_id, v_series_id) then
    raise exception 'this event type is not allowed in this group';
  end if;

  if p_candidates is null or jsonb_typeof(p_candidates) <> 'array' then
    raise exception 'add at least one proposed time';
  end if;

  v_count := jsonb_array_length(p_candidates);
  if v_count < 1 then
    raise exception 'add at least one proposed time';
  end if;

  for v_i in 0 .. (v_count - 1) loop
    v_candidate := p_candidates -> v_i;
    if not (v_candidate ? 'starts_at') then
      raise exception 'invalid candidate time';
    end if;

    v_starts := (v_candidate ->> 'starts_at')::timestamptz;
    -- End time is optional: a missing, null or empty `ends_at` means "start only".
    v_ends := nullif(pg_catalog.btrim(coalesce(v_candidate ->> 'ends_at', '')), '')::timestamptz;

    if v_starts is null or (v_ends is not null and v_ends <= v_starts) then
      raise exception 'invalid candidate time';
    end if;

    v_key := v_starts::text || '|' || coalesce(v_ends::text, '');
    if v_key = any (v_seen) then
      raise exception 'duplicate candidate time';
    end if;
    v_seen := array_append(v_seen, v_key);
  end loop;

  insert into public.events (
    group_id,
    recurrence_series_id,
    title,
    status,
    location,
    location_lat,
    location_lng,
    notes,
    starts_at,
    ends_at,
    created_by
  )
  values (
    p_group_id,
    v_series_id,
    v_title,
    'proposing'::public.event_status,
    v_location,
    p_location_lat,
    p_location_lng,
    v_notes,
    null,
    null,
    v_actor
  )
  returning id into v_event_id;

  for v_i in 0 .. (v_count - 1) loop
    v_candidate := p_candidates -> v_i;
    v_starts := (v_candidate ->> 'starts_at')::timestamptz;
    v_ends := nullif(pg_catalog.btrim(coalesce(v_candidate ->> 'ends_at', '')), '')::timestamptz;

    insert into public.event_candidates (
      event_id,
      group_id,
      starts_at,
      ends_at,
      proposed_by
    )
    values (
      v_event_id,
      p_group_id,
      v_starts,
      v_ends,
      v_actor
    );
  end loop;

  if p_set_initial_host then
    perform public.propose_creator_initial_host_for_event(v_event_id, p_initial_host_user_id);
  end if;

  return v_event_id;
end;
$function$;

comment on function public.propose_group_event(
  uuid,
  text,
  text,
  text,
  jsonb,
  jsonb,
  boolean,
  uuid,
  double precision,
  double precision
) is
  'Creates a proposing event with candidate times atomically. Candidate end time and map coordinates are optional. Event starts_at/ends_at remain unset until finalise_event.';

revoke all on function public.propose_group_event(
  uuid, text, text, text, jsonb, jsonb, boolean, uuid, double precision, double precision
) from public, anon;

grant execute on function public.propose_group_event(
  uuid, text, text, text, jsonb, jsonb, boolean, uuid, double precision, double precision
) to authenticated, service_role;
