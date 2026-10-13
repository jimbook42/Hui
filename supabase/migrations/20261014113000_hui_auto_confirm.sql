-- HUI-AUTOCONFIRM: auto-confirm proposing events when group consensus rules are met.

create or replace function public.pick_auto_confirm_candidate(p_event_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select c.id
  from public.event_candidates c
  where c.event_id = p_event_id
    and c.status = 'proposed'
    and coalesce((public.candidate_consensus(c.id) ->> 'passes')::boolean, false)
  order by c.starts_at asc, c.id asc
  limit 1;
$$;

comment on function public.pick_auto_confirm_candidate(uuid) is
  'Earliest proposed candidate (starts_at asc, id asc) that passes candidate_consensus.';

revoke all on function public.pick_auto_confirm_candidate(uuid) from public, anon, authenticated;
grant execute on function public.pick_auto_confirm_candidate(uuid) to service_role;

create or replace function public.apply_event_confirmation(
  p_event_id uuid,
  p_candidate_id uuid,
  p_actor uuid
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
  if coalesce((v_result ->> 'passes')::boolean, false) is not true then
    return false;
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
    timezone = coalesce(v_timezone, 'Pacific/Auckland')
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

comment on function public.apply_event_confirmation(uuid, uuid, uuid) is
  'Confirm a proposing event for one passing candidate (row locks). Idempotent: returns false when not proposing.';

revoke all on function public.apply_event_confirmation(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.apply_event_confirmation(uuid, uuid, uuid) to service_role;

create or replace function public.try_auto_confirm_event(p_event_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_event public.events%rowtype;
  v_candidate_id uuid;
  v_admin_veto boolean;
begin
  -- Tests set `hui.skip_auto_confirm=1` on the PGlite session; production leaves it unset.
  if pg_catalog.current_setting('hui.skip_auto_confirm', true) = '1' then
    return false;
  end if;

  select * into v_event
  from public.events
  where id = p_event_id
  for update;

  if not found or v_event.status is distinct from 'proposing' then
    return false;
  end if;

  select coalesce(gs.admin_veto_enabled, false)
  into v_admin_veto
  from public.group_settings gs
  where gs.group_id = v_event.group_id;

  if v_admin_veto then
    return false;
  end if;

  v_candidate_id := public.pick_auto_confirm_candidate(p_event_id);
  if v_candidate_id is null then
    return false;
  end if;

  return public.apply_event_confirmation(p_event_id, v_candidate_id, v_event.created_by);
end;
$function$;

comment on function public.try_auto_confirm_event(uuid) is
  'When admin veto is off and a candidate passes consensus, confirm via the same path as manual finalise (host proposal included).';

revoke all on function public.try_auto_confirm_event(uuid) from public, anon, authenticated;
grant execute on function public.try_auto_confirm_event(uuid) to service_role;

create or replace function public.finalise_event(
  p_event_id uuid,
  p_candidate_id uuid
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

  if not public.apply_event_confirmation(p_event_id, p_candidate_id, v_actor) then
    raise exception 'only a proposing event can be confirmed';
  end if;
end;
$function$;

create or replace function public.trg_event_responses_auto_confirm()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  perform public.try_auto_confirm_event(new.event_id);
  return new;
end;
$function$;

drop trigger if exists event_responses_auto_confirm on public.event_responses;
create trigger event_responses_auto_confirm
  after insert or update of response on public.event_responses
  for each row
  execute function public.trg_event_responses_auto_confirm();
