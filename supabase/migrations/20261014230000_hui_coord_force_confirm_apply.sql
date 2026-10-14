-- HUI-COORD QA: pass organiser force-confirm through apply_event_confirmation; require yes_count (not maybe).

drop function if exists public.apply_event_confirmation(uuid, uuid, uuid);

create or replace function public.apply_event_confirmation(
  p_event_id uuid,
  p_candidate_id uuid,
  p_actor uuid,
  p_force boolean default false
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_candidate public.event_candidates%rowtype;
  v_event public.events%rowtype;
  v_result jsonb;
  v_updated integer;
  v_timezone text;
  v_passes boolean;
  v_yes integer;
begin
  if p_actor is null then
    return false;
  end if;

  select * into v_candidate
  from public.event_candidates
  where id = p_candidate_id
  for update;

  if not found then
    return false;
  end if;

  select * into v_event
  from public.events
  where id = p_event_id
  for update;

  if not found
     or v_candidate.event_id is distinct from v_event.id
     or v_candidate.group_id is distinct from v_event.group_id
  then
    return false;
  end if;

  if v_event.status is distinct from 'proposing' then
    return false;
  end if;

  if v_candidate.status is distinct from 'proposed' then
    return false;
  end if;

  v_result := public.candidate_consensus(p_candidate_id);
  v_passes := coalesce((v_result ->> 'passes')::boolean, false);
  v_yes := coalesce((v_result ->> 'yes_count')::integer, 0);

  if not v_passes then
    if coalesce(p_force, false) is not true then
      return false;
    end if;
    if v_yes < 1 then
      return false;
    end if;
  end if;

  update public.event_candidates
  set status = 'selected'
  where id = p_candidate_id
    and event_id = p_event_id
    and status = 'proposed';

  get diagnostics v_updated = row_count;
  if v_updated <> 1 then
    return false;
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
    confirmed_at = pg_catalog.now(),
    timezone = coalesce(v_timezone, 'Pacific/Auckland'),
    response_deadline_at = null,
    updated_at = pg_catalog.now()
  where id = p_event_id
    and status = 'proposing';

  get diagnostics v_updated = row_count;
  if v_updated <> 1 then
    return false;
  end if;

  if not exists (
    select 1
    from public.host_assignments ha
    where ha.event_id = p_event_id
      and ha.status = 'accepted'
  ) then
    perform public.propose_event_host_for_event(p_event_id, p_actor);
  end if;

  return true;
end;
$function$;

comment on function public.apply_event_confirmation(uuid, uuid, uuid, boolean) is
  'Confirm a proposing event for one candidate. p_force skips consensus when at least one yes_count (maybe does not count).';

revoke all on function public.apply_event_confirmation(uuid, uuid, uuid, boolean) from public, anon, authenticated;
grant execute on function public.apply_event_confirmation(uuid, uuid, uuid, boolean) to service_role;

create or replace function public.finalise_event(
  p_event_id uuid,
  p_candidate_id uuid,
  p_force boolean default false
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_event public.events%rowtype;
  v_candidate public.event_candidates%rowtype;
  v_result jsonb;
  v_passes boolean;
  v_yes integer;
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
  v_passes := coalesce((v_result ->> 'passes')::boolean, false);
  v_yes := coalesce((v_result ->> 'yes_count')::integer, 0);

  if not v_passes then
    if coalesce(p_force, false) is not true then
      raise exception 'this candidate does not meet the consensus requirements';
    end if;
    if v_yes < 1 then
      raise exception 'at least one yes is required to confirm this time';
    end if;
  end if;

  perform set_config('hui.event_confirmed_notify_all', '0', true);
  if not public.apply_event_confirmation(p_event_id, p_candidate_id, v_actor, p_force) then
    raise exception 'only a proposing event can be confirmed';
  end if;
  perform set_config('hui.event_confirmed_notify_all', '', true);
end;
$function$;
