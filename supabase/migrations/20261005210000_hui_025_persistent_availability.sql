-- HUI-025: standing (persistent) availability per user per group.
-- Private to the owner: other members cannot read detailed weekly patterns.

create type public.standing_availability_kind as enum (
  'usually_available',
  'usually_unavailable'
);

create table public.group_member_standing_availability (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  day_of_week smallint not null,
  start_minute smallint not null default 0,
  end_minute smallint not null default 1440,
  kind public.standing_availability_kind not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint standing_availability_dow check (day_of_week between 0 and 6),
  constraint standing_availability_minutes check (
    start_minute >= 0
    and start_minute < 1440
    and end_minute > 0
    and end_minute <= 1440
    and end_minute > start_minute
  ),
  constraint standing_availability_unique_window unique (
    group_id,
    user_id,
    day_of_week,
    start_minute,
    end_minute
  )
);

comment on table public.group_member_standing_availability is
  'Standing weekly availability windows for one member in one group. Owner-only visibility; never writes event_responses.';

create index group_member_standing_availability_group_user_idx
  on public.group_member_standing_availability (group_id, user_id);

create or replace function public.standing_availability_before_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;

  if new.user_id is distinct from v_user then
    raise exception 'can only manage your own standing availability';
  end if;

  if not exists (
    select 1
    from public.group_memberships m
    where m.group_id = new.group_id
      and m.user_id = v_user
      and m.status = 'active'
  ) then
    raise exception 'active group membership required';
  end if;

  return new;
end;
$function$;

create trigger group_member_standing_availability_set_updated_at
  before update on public.group_member_standing_availability
  for each row execute function public.set_updated_at();

create trigger group_member_standing_availability_before_write
  before insert or update on public.group_member_standing_availability
  for each row execute function public.standing_availability_before_write();

alter table public.group_member_standing_availability enable row level security;
alter table public.group_member_standing_availability force row level security;

create policy group_member_standing_availability_select
  on public.group_member_standing_availability
  for select
  to authenticated
  using (
    user_id = auth.uid()
    and public.is_active_member(group_id)
  );

create policy group_member_standing_availability_insert
  on public.group_member_standing_availability
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and public.is_active_member(group_id)
  );

create policy group_member_standing_availability_update
  on public.group_member_standing_availability
  for update
  to authenticated
  using (
    user_id = auth.uid()
    and public.is_active_member(group_id)
  )
  with check (
    user_id = auth.uid()
    and public.is_active_member(group_id)
  );

create policy group_member_standing_availability_delete
  on public.group_member_standing_availability
  for delete
  to authenticated
  using (
    user_id = auth.uid()
    and public.is_active_member(group_id)
  );

revoke all on table public.group_member_standing_availability from public, anon, authenticated;
grant select, insert, update, delete on table public.group_member_standing_availability to authenticated;
grant all on table public.group_member_standing_availability to service_role;
