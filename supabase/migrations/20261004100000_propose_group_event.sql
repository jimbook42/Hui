-- HUI-026A: atomic group event proposal (event + candidates, no premature final timing).

create or replace function public.propose_group_event(
  p_group_id uuid,
  p_title text,
  p_location text,
  p_notes text,
  p_recurrence jsonb,
  p_candidates jsonb,
  p_set_initial_host boolean,
  p_initial_host_user_id uuid
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
    if not (v_candidate ? 'starts_at' and v_candidate ? 'ends_at') then
      raise exception 'invalid candidate time';
    end if;

    v_starts := (v_candidate ->> 'starts_at')::timestamptz;
    v_ends := (v_candidate ->> 'ends_at')::timestamptz;

    if v_starts is null or v_ends is null or v_ends <= v_starts then
      raise exception 'invalid candidate time';
    end if;

    v_key := v_starts::text || '|' || v_ends::text;
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
    v_notes,
    null,
    null,
    v_actor
  )
  returning id into v_event_id;

  for v_i in 0 .. (v_count - 1) loop
    v_candidate := p_candidates -> v_i;
    v_starts := (v_candidate ->> 'starts_at')::timestamptz;
    v_ends := (v_candidate ->> 'ends_at')::timestamptz;

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
  uuid
) is
  'Creates a proposing event with candidate times atomically. Event starts_at/ends_at remain unset until finalise_event.';

revoke all on function public.propose_group_event(uuid, text, text, text, jsonb, jsonb, boolean, uuid)
  from public, anon;

grant execute on function public.propose_group_event(uuid, text, text, text, jsonb, jsonb, boolean, uuid)
  to authenticated, service_role;
