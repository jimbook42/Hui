-- HUI-ONBOARDING-003: gathering planning workflow (invites, contributions at propose, hosting rule, recurrence).

-- Host proposals must not fire on attendance responses; coordinate when confirming or explicitly needed.
drop trigger if exists event_responses_maybe_propose_host on public.event_responses;

create or replace function public.apply_proposal_contribution_requests(
  p_event_id uuid,
  p_actor uuid,
  p_requests jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_group_id uuid;
  v_status public.event_status;
  v_host_user uuid;
  v_host_name text;
  v_item jsonb;
  v_i integer;
  v_count integer;
  v_category_id uuid;
  v_label text;
  v_category_name text;
  v_follows_host boolean;
  v_seen uuid[] := array[]::uuid[];
begin
  if p_requests is null or jsonb_typeof(p_requests) <> 'array' then
    return;
  end if;

  v_count := jsonb_array_length(p_requests);
  if v_count < 1 then
    return;
  end if;

  select e.group_id, e.status
  into v_group_id, v_status
  from public.events e
  where e.id = p_event_id;

  if v_group_id is null or v_status is distinct from 'proposing' then
    raise exception 'contributions can only be requested on a proposing hui';
  end if;

  select ha.user_id, ha.display_name
  into v_host_user, v_host_name
  from public.host_assignments ha
  where ha.event_id = p_event_id
    and ha.status = 'accepted'
    and ha.user_id is not null
  order by ha.created_at desc
  limit 1;

  for v_i in 0 .. (v_count - 1) loop
    v_item := p_requests -> v_i;
    if not (v_item ? 'category_id') then
      raise exception 'invalid contribution request';
    end if;

    v_category_id := (v_item ->> 'category_id')::uuid;
    if v_category_id is null or v_category_id = any (v_seen) then
      continue;
    end if;
    v_seen := array_append(v_seen, v_category_id);

    select c.name, c.follows_host
    into v_category_name, v_follows_host
    from public.contribution_categories c
    where c.id = v_category_id
      and c.group_id = v_group_id
      and c.archived_at is null;

    if v_category_name is null then
      raise exception 'contribution category not found or inactive';
    end if;

    if exists (
      select 1
      from public.event_contributions ec
      where ec.event_id = p_event_id
        and ec.category_id = v_category_id
    ) then
      continue;
    end if;

    v_label := nullif(pg_catalog.btrim(coalesce(v_item ->> 'label', '')), '');
    if v_label is null then
      v_label := v_category_name;
    end if;

    if pg_catalog.char_length(v_label) < 1 or pg_catalog.char_length(v_label) > 160 then
      raise exception 'contribution description must be between 1 and 160 characters';
    end if;

    if v_follows_host then
      if v_host_user is null then
        insert into public.event_contributions (
          event_id, group_id, category_id, user_id, label, status, assigned_by
        )
        values (
          p_event_id, v_group_id, v_category_id, null, v_label, 'open', coalesce(p_actor, v_host_user)
        );
      else
        insert into public.event_contributions (
          event_id, group_id, category_id, user_id, label, status, display_name, assigned_by
        )
        values (
          p_event_id,
          v_group_id,
          v_category_id,
          v_host_user,
          v_label,
          'accepted'::public.contribution_status,
          v_host_name,
          coalesce(p_actor, v_host_user)
        );
      end if;
    else
      insert into public.event_contributions (
        event_id, group_id, category_id, user_id, label, status, assigned_by
      )
      values (
        p_event_id, v_group_id, v_category_id, null, v_label, 'open', p_actor
      );
    end if;
  end loop;
end;
$function$;

create or replace function public.commit_proposer_as_confirmed_host(p_event_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_user uuid := auth.uid();
  v_group_id uuid;
  v_created_by uuid;
  v_status public.event_status;
  v_hosting_enabled boolean;
  v_display_name text;
  v_assignment_id uuid;
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;

  select e.group_id, e.created_by, e.status
  into v_group_id, v_created_by, v_status
  from public.events e
  where e.id = p_event_id;

  if v_group_id is null then
    raise exception 'event not found';
  end if;

  if v_created_by is distinct from v_user then
    raise exception 'only the proposer can commit to hosting during setup';
  end if;

  if v_status is distinct from 'proposing' then
    raise exception 'hosting commitment is only available while planning';
  end if;

  select coalesce(gs.hosting_enabled, true)
  into v_hosting_enabled
  from public.group_settings gs
  where gs.group_id = v_group_id;

  if not coalesce(v_hosting_enabled, true) then
    raise exception 'hosting is disabled for this group';
  end if;

  if not exists (
    select 1
    from public.group_memberships m
    where m.group_id = v_group_id
      and m.user_id = v_user
      and m.status = 'active'
      and m.hosting_standing is distinct from 'never'
  ) then
    raise exception 'you are not eligible to host this gathering';
  end if;

  if exists (
    select 1
    from public.host_assignments ha
    where ha.event_id = p_event_id
      and ha.status = 'accepted'
  ) then
    return (
      select ha.id
      from public.host_assignments ha
      where ha.event_id = p_event_id
        and ha.status = 'accepted'
      order by ha.created_at desc
      limit 1
    );
  end if;

  update public.host_assignments ha
  set status = 'swapped_out'
  where ha.event_id = p_event_id
    and ha.status in ('proposed', 'accepted');

  select p.display_name into v_display_name
  from public.profiles p
  where p.id = v_user;

  insert into public.host_assignments (
    event_id,
    group_id,
    user_id,
    status,
    display_name,
    assigned_by,
    responded_at
  )
  values (
    p_event_id,
    v_group_id,
    v_user,
    'accepted',
    coalesce(v_display_name, 'Member'),
    v_user,
    now()
  )
  returning id into v_assignment_id;

  perform public.sync_host_bound_contributions(p_event_id);

  return v_assignment_id;
end;
$function$;

create or replace function public.finalise_event(
  p_event_id uuid,
  p_candidate_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_actor uuid := auth.uid();
  v_event public.events%rowtype;
  v_candidate public.event_candidates%rowtype;
  v_result jsonb;
  v_updated integer;
  v_timezone text;
begin
  if v_actor is null then
    raise exception 'not authenticated';
  end if;

  select * into v_candidate
  from public.event_candidates
  where id = p_candidate_id
  for update;

  if not found then
    raise exception 'candidate not found';
  end if;

  select * into v_event
  from public.events
  where id = p_event_id
  for update;

  if not found or not public.is_active_member(v_event.group_id) then
    raise exception 'event not found';
  end if;

  if v_candidate.event_id is distinct from v_event.id
     or v_candidate.group_id is distinct from v_event.group_id
  then
    raise exception 'candidate not found';
  end if;

  if not (
    public.is_group_admin(v_event.group_id)
    or v_event.created_by = v_actor
  ) then
    raise exception 'you cannot finalise this event';
  end if;

  if v_event.status = 'confirmed' then
    raise exception 'this event is already confirmed';
  end if;

  if v_event.status = 'cancelled' then
    raise exception 'cancelled events cannot be confirmed';
  end if;

  if v_event.status is distinct from 'proposing' then
    raise exception 'only a proposing event can be confirmed';
  end if;

  if v_candidate.status = 'withdrawn' then
    raise exception 'a withdrawn candidate cannot be finalised';
  end if;

  if v_candidate.status is distinct from 'proposed' then
    raise exception 'this candidate cannot be finalised';
  end if;

  v_result := public.candidate_consensus(p_candidate_id);
  if coalesce((v_result ->> 'passes')::boolean, false) is not true then
    raise exception 'this candidate does not meet the consensus requirements';
  end if;

  update public.event_candidates
  set status = 'selected'
  where id = p_candidate_id
    and event_id = p_event_id
    and status = 'proposed';

  get diagnostics v_updated = row_count;
  if v_updated <> 1 then
    raise exception 'this candidate cannot be finalised';
  end if;

  select gs.timezone
  into v_timezone
  from public.group_settings gs
  where gs.group_id = v_event.group_id;

  update public.events
  set
    status = 'confirmed',
    starts_at = v_candidate.starts_at,
    ends_at = v_candidate.ends_at,
    confirmed_at = now(),
    timezone = coalesce(v_timezone, 'Pacific/Auckland')
  where id = p_event_id
    and status = 'proposing';

  get diagnostics v_updated = row_count;
  if v_updated <> 1 then
    raise exception 'only a proposing event can be confirmed';
  end if;

  perform public.seed_event_contributions(p_event_id, v_actor);

  if not exists (
    select 1
    from public.host_assignments ha
    where ha.event_id = p_event_id
      and ha.status = 'accepted'
  ) then
    perform public.propose_event_host_for_event(p_event_id, v_actor);
  end if;
end;
$function$;

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
  double precision,
  public.gathering_type,
  text
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
  p_location_lat double precision,
  p_location_lng double precision,
  p_gathering_type public.gathering_type,
  p_gathering_type_custom text,
  p_requested_contributions jsonb default '[]'::jsonb,
  p_organiser_commits_host boolean default false
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
  v_gathering_custom text;
begin
  if v_actor is null then
    raise exception 'not authenticated';
  end if;

  if not public.can_propose_in_group(p_group_id) then
    raise exception 'you cannot propose events in this group';
  end if;

  if p_gathering_type is null then
    raise exception 'choose what you are planning';
  end if;

  v_gathering_custom := nullif(pg_catalog.btrim(coalesce(p_gathering_type_custom, '')), '');
  if p_gathering_type = 'other'::public.gathering_type and v_gathering_custom is null then
    raise exception 'describe what you are planning';
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
    elsif v_starts_on is not null then
      v_planning_target := v_starts_on;
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

      update public.group_settings
      set
        recurrence_interval_unit = v_unit,
        recurrence_interval_count = v_interval,
        recurrence_anchor_date = v_starts_on,
        canonical_recurrence_series_id = v_series_id
      where group_id = p_group_id;
    end if;
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
    gathering_type,
    gathering_type_custom,
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
    p_gathering_type,
    v_gathering_custom,
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

  if coalesce(p_organiser_commits_host, false) then
    perform public.commit_proposer_as_confirmed_host(v_event_id);
  end if;

  if p_requested_contributions is not null
     and jsonb_typeof(p_requested_contributions) = 'array'
     and jsonb_array_length(p_requested_contributions) > 0 then
    perform public.apply_proposal_contribution_requests(
      v_event_id,
      v_actor,
      p_requested_contributions
    );
  end if;

  return v_event_id;
end;
$function$;

revoke all on function public.apply_proposal_contribution_requests(uuid, uuid, jsonb) from public, anon;
grant execute on function public.apply_proposal_contribution_requests(uuid, uuid, jsonb) to authenticated, service_role;

revoke all on function public.commit_proposer_as_confirmed_host(uuid) from public, anon;
grant execute on function public.commit_proposer_as_confirmed_host(uuid) to authenticated, service_role;

revoke all on function public.propose_group_event(
  uuid, text, text, text, jsonb, jsonb, boolean, uuid, double precision, double precision,
  public.gathering_type, text, jsonb, boolean
) from public, anon;

grant execute on function public.propose_group_event(
  uuid, text, text, text, jsonb, jsonb, boolean, uuid, double precision, double precision,
  public.gathering_type, text, jsonb, boolean
) to authenticated, service_role;

notify pgrst, 'reload schema';
