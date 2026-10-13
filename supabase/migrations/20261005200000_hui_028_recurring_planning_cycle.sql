-- HUI-028: recurring planning cycle — group cadence, nominal targets, duplicate-safe proposals.

alter table public.group_settings
  add column if not exists recurrence_interval_unit public.cadence_unit,
  add column if not exists recurrence_interval_count integer,
  add column if not exists recurrence_anchor_date date,
  add column if not exists planning_lead_days integer not null default 14,
  add column if not exists canonical_recurrence_series_id uuid;

alter table public.group_settings
  add constraint group_settings_recurrence_interval_count_check
    check (recurrence_interval_count is null or recurrence_interval_count >= 1),
  add constraint group_settings_planning_lead_days_check
    check (planning_lead_days between 0 and 365);

alter table public.events
  add column if not exists planning_target_date date;

create unique index if not exists events_group_planning_target_active_key
  on public.events (group_id, planning_target_date)
  where planning_target_date is not null and status <> 'cancelled';

comment on column public.group_settings.planning_lead_days is
  'Days before the nominal next hui date when planning should become relevant.';
comment on column public.events.planning_target_date is
  'Nominal target date for this planning cycle (not a confirmed event time).';

drop function if exists public.propose_group_event(
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
);

-- Backfill cadence from each group''s latest recurrence series.
update public.group_settings gs
set
  recurrence_interval_unit = rs.interval_unit,
  recurrence_interval_count = rs.interval_count,
  recurrence_anchor_date = rs.starts_on,
  canonical_recurrence_series_id = rs.id
from (
  select distinct on (group_id)
    id,
    group_id,
    interval_unit,
    interval_count,
    starts_on
  from public.recurrence_series
  where archived_at is null
  order by group_id, created_at desc
) rs
where gs.group_id = rs.group_id
  and gs.recurrence_interval_unit is null;

alter table public.group_settings
  add constraint group_settings_canonical_series_fkey
    foreign key (canonical_recurrence_series_id, group_id)
    references public.recurrence_series (id, group_id)
    on delete set null;

create or replace function public.propose_group_event(
  p_group_id uuid,
  p_title text,
  p_location text,
  p_notes text,
  p_recurrence jsonb,
  p_candidates jsonb,
  p_set_initial_host boolean,
  p_initial_host_user_id uuid,
  p_location_lat double precision,
  p_location_lng double precision
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
  v_planning_target date;
  v_canonical uuid;
  v_unit public.cadence_unit;
  v_interval integer;
  v_starts_on date;
  v_series_title text;
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

  v_planning_target := null;
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

    v_series_title := pg_catalog.btrim(p_recurrence ->> 'series_title');
    if pg_catalog.char_length(v_series_title) < 1
       or pg_catalog.char_length(v_series_title) > 160 then
      raise exception 'enter valid recurrence settings';
    end if;

    if (p_recurrence ->> 'interval_unit') not in ('week', 'month') then
      raise exception 'enter valid recurrence settings';
    end if;

    v_interval := (p_recurrence ->> 'interval_count')::integer;
    if v_interval < 1 then
      raise exception 'enter valid recurrence settings';
    end if;

    v_unit := (p_recurrence ->> 'interval_unit')::public.cadence_unit;
    v_starts_on := (p_recurrence ->> 'starts_on')::date;

    if p_recurrence ? 'planning_target_date'
       and p_recurrence ->> 'planning_target_date' is not null
       and pg_catalog.btrim(p_recurrence ->> 'planning_target_date') <> '' then
      v_planning_target := (p_recurrence ->> 'planning_target_date')::date;
    end if;

    if v_planning_target is not null and exists (
      select 1
      from public.events e
      where e.group_id = p_group_id
        and e.planning_target_date = v_planning_target
        and e.status <> 'cancelled'
    ) then
      raise exception 'a hui is already being planned for this cycle';
    end if;

    select gs.canonical_recurrence_series_id
    into v_canonical
    from public.group_settings gs
    where gs.group_id = p_group_id;

    if v_canonical is not null then
      select rs.id
      into v_series_id
      from public.recurrence_series rs
      where rs.id = v_canonical
        and rs.group_id = p_group_id
        and rs.archived_at is null;
    end if;

    if v_series_id is null then
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
        v_series_title,
        v_unit,
        v_interval,
        v_starts_on,
        v_actor
      )
      returning id into v_series_id;
    else
      update public.recurrence_series
      set
        title = v_series_title,
        interval_unit = v_unit,
        interval_count = v_interval,
        starts_on = v_starts_on,
        updated_at = now()
      where id = v_series_id;
    end if;

    update public.group_settings
    set
      recurrence_interval_unit = v_unit,
      recurrence_interval_count = v_interval,
      recurrence_anchor_date = v_starts_on,
      canonical_recurrence_series_id = v_series_id
    where group_id = p_group_id;
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
    planning_target_date,
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
    v_planning_target,
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
  'Creates a proposing event with candidate times atomically. Reuses group recurrence series when set; planning_target_date prevents duplicate cycle proposals.';
