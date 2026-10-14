-- HUI-030 hardening (part 1): planning reminder audience, confirmation method for organiser force confirm.

do $enum$
begin
  create type public.planning_reminders_audience as enum ('admins_only', 'everyone');
exception
  when duplicate_object then null;
end
$enum$;

do $enum$
begin
  create type public.event_confirmation_method as enum ('consensus', 'organiser');
exception
  when duplicate_object then null;
end
$enum$;

alter table public.group_settings
  add column if not exists planning_reminders_audience public.planning_reminders_audience not null default 'admins_only';

comment on column public.group_settings.planning_reminders_audience is
  'Who receives planning_cycle_opens nudges: active owners/admins only, or every active member.';

alter table public.events
  add column if not exists confirmation_method public.event_confirmation_method;

comment on column public.events.confirmation_method is
  'How this hui was confirmed; organiser when manual force-confirm was used.';

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
  v_method public.event_confirmation_method;
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
    v_method := 'organiser';
  else
    v_method := 'consensus';
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
    confirmation_method = v_method,
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

create or replace function public.enqueue_planning_cycle_nudges(
  p_as_of date default current_date
)
returns integer
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_row record;
  v_member record;
  v_queued integer := 0;
  v_title text := 'Time to plan the next hui';
  v_body text;
  v_dedupe text;
  v_notification_id uuid;
begin
  for v_row in
    select
      s.group_id,
      s.next_nominal_date,
      s.planning_opens_on,
      g.name as group_name,
      coalesce(gs.planning_reminders_audience, 'admins_only'::public.planning_reminders_audience) as reminders_audience
    from public.group_planning_cycle_snapshots s
    inner join public.group_settings gs on gs.group_id = s.group_id
    inner join public.groups g on g.id = s.group_id
    left join public.group_recurrence_preferences pref on pref.group_id = s.group_id
    where s.phase = 'ready_to_plan'
      and s.next_nominal_date is not null
      and s.planning_opens_on is not null
      and s.planning_opens_on <= p_as_of
      and pref.recurrence_paused_at is null
      and not exists (
        select 1
        from public.events e
        where e.group_id = s.group_id
          and e.status in ('proposing', 'confirmed')
          and e.planning_target_date = s.next_nominal_date
      )
  loop
    v_dedupe := 'planning_cycle_opens:' || v_row.group_id::text || ':' || v_row.next_nominal_date::text;
    v_body := 'Planning is open for ' || v_row.group_name || ' around ' || to_char(v_row.next_nominal_date, 'DD Mon YYYY') || '.';

    for v_member in
      select m.user_id, m.role
      from public.group_memberships m
      where m.group_id = v_row.group_id
        and m.status = 'active'
        and (
          v_row.reminders_audience = 'everyone'::public.planning_reminders_audience
          or m.role in ('owner', 'admin')
        )
    loop
      v_notification_id := public.queue_member_notification(
        v_member.user_id,
        'planning_cycle_opens'::public.notification_kind,
        v_title,
        v_body,
        v_row.group_id,
        null,
        v_dedupe,
        false
      );
      if v_notification_id is not null then
        v_queued := v_queued + 1;
      end if;
    end loop;
  end loop;

  return v_queued;
end;
$function$;
