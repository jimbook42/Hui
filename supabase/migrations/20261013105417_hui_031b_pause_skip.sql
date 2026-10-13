-- HUI-031-B: pause, skip, planning snapshot cache, cron stub.

create table public.group_recurrence_preferences (
  group_id uuid primary key references public.groups (id) on delete cascade,
  preference_json jsonb not null default '{}'::jsonb,
  recurrence_paused_at timestamptz,
  paused_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.group_planning_cycle_skips (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  nominal_date date not null,
  reason text,
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint planning_skip_unique unique (group_id, nominal_date),
  constraint planning_skip_reason_length check (
    reason is null or char_length(pg_catalog.btrim(reason)) between 1 and 500
  )
);

create index group_planning_cycle_skips_group_idx
  on public.group_planning_cycle_skips (group_id);

create table public.group_planning_cycle_snapshots (
  group_id uuid primary key references public.groups (id) on delete cascade,
  next_nominal_date date,
  planning_opens_on date,
  phase text not null,
  derived_at timestamptz not null default now(),
  derivation_version smallint not null default 1
);

create trigger group_recurrence_preferences_set_updated_at
  before update on public.group_recurrence_preferences
  for each row execute function public.set_updated_at();

alter table public.group_recurrence_preferences enable row level security;
alter table public.group_planning_cycle_skips enable row level security;
alter table public.group_planning_cycle_snapshots enable row level security;

create policy group_recurrence_preferences_select
  on public.group_recurrence_preferences
  for select
  to authenticated
  using (public.is_active_member(group_id));

create policy group_recurrence_preferences_admin_write
  on public.group_recurrence_preferences
  for all
  to authenticated
  using (public.is_group_admin(group_id))
  with check (public.is_group_admin(group_id));

create policy group_planning_cycle_skips_select
  on public.group_planning_cycle_skips
  for select
  to authenticated
  using (public.is_active_member(group_id));

create policy group_planning_cycle_skips_admin_insert
  on public.group_planning_cycle_skips
  for insert
  to authenticated
  with check (public.is_group_admin(group_id));

create policy group_planning_cycle_snapshots_select
  on public.group_planning_cycle_snapshots
  for select
  to authenticated
  using (public.is_active_member(group_id));

revoke all on table public.group_recurrence_preferences from public, anon;
revoke all on table public.group_planning_cycle_skips from public, anon;
revoke all on table public.group_planning_cycle_snapshots from public, anon;

grant select on public.group_recurrence_preferences to authenticated;
grant select, insert on public.group_planning_cycle_skips to authenticated;
grant select on public.group_planning_cycle_snapshots to authenticated;
grant all on public.group_recurrence_preferences to service_role;
grant all on public.group_planning_cycle_skips to service_role;
grant all on public.group_planning_cycle_snapshots to service_role;

create or replace function public.upsert_group_planning_snapshot(
  p_group_id uuid,
  p_next_nominal_date date,
  p_planning_opens_on date,
  p_phase text
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if not public.is_active_member(p_group_id) then
    raise exception 'not a member of this group';
  end if;

  insert into public.group_planning_cycle_snapshots (
    group_id,
    next_nominal_date,
    planning_opens_on,
    phase,
    derived_at,
    derivation_version
  ) values (
    p_group_id,
    p_next_nominal_date,
    p_planning_opens_on,
    p_phase,
    pg_catalog.now(),
    1
  )
  on conflict (group_id) do update set
    next_nominal_date = excluded.next_nominal_date,
    planning_opens_on = excluded.planning_opens_on,
    phase = excluded.phase,
    derived_at = excluded.derived_at;
end;
$function$;

revoke all on function public.upsert_group_planning_snapshot(uuid, date, date, text) from public, anon;
grant execute on function public.upsert_group_planning_snapshot(uuid, date, date, text) to authenticated, service_role;

create or replace function public.set_group_recurrence_paused(
  p_group_id uuid,
  p_paused boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
begin
  if v_actor is null then
    raise exception 'not authenticated';
  end if;

  if not public.is_active_member(p_group_id) then
    raise exception 'not a member of this group';
  end if;

  if not public.is_group_admin(p_group_id) then
    raise exception 'only a group admin can change recurrence pause';
  end if;

  insert into public.group_recurrence_preferences (group_id, recurrence_paused_at, paused_by)
  values (
    p_group_id,
    case when p_paused then pg_catalog.now() else null end,
    case when p_paused then v_actor else null end
  )
  on conflict (group_id) do update set
    recurrence_paused_at = excluded.recurrence_paused_at,
    paused_by = excluded.paused_by,
    updated_at = pg_catalog.now();
end;
$function$;

revoke all on function public.set_group_recurrence_paused(uuid, boolean) from public, anon;
grant execute on function public.set_group_recurrence_paused(uuid, boolean) to authenticated, service_role;

create or replace function public.skip_group_planning_cycle(
  p_group_id uuid,
  p_nominal_date date,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_reason text;
begin
  if v_actor is null then
    raise exception 'not authenticated';
  end if;

  if not public.is_active_member(p_group_id) then
    raise exception 'not a member of this group';
  end if;

  if not public.is_group_admin(p_group_id) then
    raise exception 'only a group admin can skip a planning cycle';
  end if;

  if p_nominal_date is null then
    raise exception 'enter a valid nominal date';
  end if;

  if exists (
    select 1
    from public.events e
    where e.group_id = p_group_id
      and e.planning_target_date = p_nominal_date
      and e.status <> 'cancelled'
  ) then
    raise exception 'a hui already exists for this cycle';
  end if;

  if p_reason is not null then
    v_reason := pg_catalog.btrim(p_reason);
    if v_reason = '' then
      v_reason := null;
    end if;
  end if;

  insert into public.group_planning_cycle_skips (
    group_id,
    nominal_date,
    reason,
    created_by
  ) values (
    p_group_id,
    p_nominal_date,
    v_reason,
    v_actor
  );
end;
$function$;

revoke all on function public.skip_group_planning_cycle(uuid, date, text) from public, anon;
grant execute on function public.skip_group_planning_cycle(uuid, date, text) to authenticated, service_role;

create or replace function public.refresh_all_group_planning_snapshots()
returns integer
language plpgsql
security definer
set search_path = ''
as $function$
begin
  -- Cron hook (HUI-031-B): recompute via app worker; returns 0 until wired.
  return 0;
end;
$function$;

comment on function public.refresh_all_group_planning_snapshots() is
  'Stub entrypoint for scheduled snapshot refresh. App upserts snapshots on skip/pause/complete.';

revoke all on function public.refresh_all_group_planning_snapshots() from public, anon, authenticated;
grant execute on function public.refresh_all_group_planning_snapshots() to service_role;
