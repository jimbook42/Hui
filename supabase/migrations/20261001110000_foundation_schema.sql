-- Hui foundation schema.
-- Auth identity lives in auth.users (Supabase Auth). This migration does not
-- create a login system. Historical rows keep a profile reference plus a
-- display-name snapshot where the fact is a record of the past. Membership
-- removal updates status; it does not delete gatherings.
-- Row level security is enabled here and policies are added in the next migration.

create type public.membership_role as enum ('owner', 'admin', 'member');
create type public.membership_status as enum ('active', 'removed');
create type public.membership_change_action as enum (
  'joined',
  'role_changed',
  'removed',
  'restored'
);
create type public.proposer_policy as enum ('admins_only', 'any_member');
create type public.consensus_rule as enum (
  'required_participants',
  'minimum_attendees',
  'all_active_members'
);
create type public.cadence_unit as enum ('week', 'month');
create type public.event_status as enum (
  'draft',
  'proposing',
  'voting',
  'awaiting_agreement',
  'confirmed',
  'reopened',
  'completed',
  'cancelled'
);
create type public.candidate_status as enum (
  'proposed',
  'selected',
  'withdrawn',
  'declined'
);
create type public.response_value as enum ('yes', 'no', 'maybe');
create type public.response_visibility as enum ('group', 'private');
create type public.host_assignment_status as enum (
  'proposed',
  'accepted',
  'declined',
  'swapped_out'
);
create type public.contribution_status as enum (
  'open',
  'accepted',
  'declined',
  'completed'
);
-- Self-reported labels. These are not medical or "allergen-free" certifications.
create type public.dietary_category as enum (
  'allergy',
  'requirement',
  'dislike',
  'preference'
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

-- True when this statement is running as the table owner (migration role or a
-- security definer function owned by that role). Authenticated sessions cannot
-- spoof this by setting a custom GUC.
create or replace function public.running_as_table_owner(p_table regclass)
returns boolean
language sql
stable
set search_path = public
as $function$
  select current_user = pg_get_userbyid(c.relowner)
  from pg_class c
  where c.oid = p_table;
$function$;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_display_name_length check (char_length(display_name) between 1 and 80)
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_name text;
begin
  -- Creates the profile row Supabase Auth does not create itself.
  -- SECURITY DEFINER: the inserting auth role cannot write public.profiles directly.
  v_name := nullif(
    btrim(coalesce(new.raw_user_meta_data, '{}'::jsonb) ->> 'display_name'),
    ''
  );
  if v_name is null and new.email is not null then
    v_name := nullif(split_part(new.email, '@', 1), '');
  end if;
  v_name := left(coalesce(v_name, 'Member'), 80);

  insert into public.profiles (id, display_name)
  values (new.id, v_name);

  return new;
end;
$function$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint groups_name_length check (char_length(name) between 1 and 120)
);

create table public.group_settings (
  group_id uuid primary key references public.groups (id) on delete cascade,
  who_may_propose public.proposer_policy not null default 'any_member',
  one_off_events_allowed boolean not null default true,
  recurring_events_enabled boolean not null default true,
  maybe_responses_enabled boolean not null default true,
  minimum_attendees integer not null default 1,
  proposal_deadline_hours integer,
  consensus_rule public.consensus_rule not null default 'required_participants',
  admin_veto_enabled boolean not null default false,
  host_veto_enabled boolean not null default false,
  reconnect_reminders_enabled boolean not null default false,
  reconnect_after_days integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint group_settings_minimum_attendees_check check (minimum_attendees >= 1),
  constraint group_settings_deadline_check check (
    proposal_deadline_hours is null or proposal_deadline_hours > 0
  ),
  constraint group_settings_reconnect_days_check check (
    reconnect_after_days is null or reconnect_after_days between 1 and 3650
  ),
  constraint group_settings_reconnect_check check (
    reconnect_reminders_enabled = false or reconnect_after_days is not null
  ),
  constraint group_settings_event_mode_check check (
    recurring_events_enabled or one_off_events_allowed
  )
);

create table public.group_memberships (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete restrict,
  user_id uuid not null references public.profiles (id) on delete restrict,
  role public.membership_role not null,
  status public.membership_status not null default 'active',
  consensus_required boolean not null default false,
  joined_at timestamptz not null default now(),
  removed_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint group_memberships_group_user_key unique (group_id, user_id),
  constraint group_memberships_removed_at_check check (
    (status = 'removed' and removed_at is not null)
    or (status = 'active' and removed_at is null)
  ),
  constraint group_memberships_owner_is_active check (
    role <> 'owner' or status = 'active'
  )
);

create table public.membership_changes (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete restrict,
  subject_user_id uuid not null references public.profiles (id) on delete restrict,
  actor_user_id uuid references public.profiles (id) on delete restrict,
  action public.membership_change_action not null,
  previous_role public.membership_role,
  new_role public.membership_role,
  previous_status public.membership_status,
  new_status public.membership_status,
  created_at timestamptz not null default now()
);

create table public.households (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete restrict,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint households_name_length check (char_length(name) between 1 and 80),
  constraint households_id_group_key unique (id, group_id)
);

create table public.household_members (
  household_id uuid not null,
  group_id uuid not null,
  user_id uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (household_id, user_id),
  constraint household_members_household_fkey
    foreign key (household_id, group_id)
    references public.households (id, group_id)
    on delete cascade,
  constraint household_members_one_household_per_group unique (group_id, user_id)
);

create table public.recurrence_series (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete restrict,
  title text not null,
  interval_unit public.cadence_unit not null,
  interval_count integer not null,
  starts_on date not null,
  ends_on date,
  created_by uuid not null references public.profiles (id) on delete restrict,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint recurrence_series_title_length check (char_length(title) between 1 and 160),
  constraint recurrence_series_interval_check check (interval_count >= 1),
  constraint recurrence_series_ends_on_check check (ends_on is null or ends_on >= starts_on),
  constraint recurrence_series_id_group_key unique (id, group_id)
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete restrict,
  recurrence_series_id uuid,
  title text not null,
  status public.event_status not null default 'draft',
  location text,
  notes text,
  starts_at timestamptz,
  ends_at timestamptz,
  created_by uuid not null references public.profiles (id) on delete restrict,
  confirmed_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint events_title_length check (char_length(title) between 1 and 160),
  constraint events_location_length check (
    location is null or char_length(location) between 1 and 200
  ),
  constraint events_notes_length check (
    notes is null or char_length(notes) between 1 and 2000
  ),
  constraint events_time_check check (
    ends_at is null or starts_at is null or ends_at > starts_at
  ),
  constraint events_id_group_key unique (id, group_id),
  constraint events_series_fkey
    foreign key (recurrence_series_id, group_id)
    references public.recurrence_series (id, group_id)
    on delete restrict
);

create table public.event_candidates (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null,
  group_id uuid not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status public.candidate_status not null default 'proposed',
  proposed_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint event_candidates_time_check check (ends_at > starts_at),
  constraint event_candidates_id_event_group_key unique (id, event_id, group_id),
  constraint event_candidates_event_fkey
    foreign key (event_id, group_id)
    references public.events (id, group_id)
    on delete restrict
);

create table public.event_responses (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null,
  event_id uuid not null,
  group_id uuid not null,
  user_id uuid not null references public.profiles (id) on delete restrict,
  response public.response_value not null,
  visibility public.response_visibility not null default 'group',
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint event_responses_candidate_user_key unique (candidate_id, user_id),
  constraint event_responses_note_length check (
    note is null or char_length(note) between 1 and 500
  ),
  constraint event_responses_candidate_fkey
    foreign key (candidate_id, event_id, group_id)
    references public.event_candidates (id, event_id, group_id)
    on delete restrict
);

create table public.host_assignments (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null,
  group_id uuid not null,
  user_id uuid references public.profiles (id) on delete restrict,
  household_id uuid,
  status public.host_assignment_status not null default 'proposed',
  display_name text not null,
  assigned_by uuid not null references public.profiles (id) on delete restrict,
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint host_assignments_target_check check (
    (user_id is not null and household_id is null)
    or (user_id is null and household_id is not null)
  ),
  constraint host_assignments_display_name_length check (
    char_length(display_name) between 1 and 80
  ),
  constraint host_assignments_event_fkey
    foreign key (event_id, group_id)
    references public.events (id, group_id)
    on delete restrict,
  constraint host_assignments_household_fkey
    foreign key (household_id, group_id)
    references public.households (id, group_id)
    on delete restrict
);

create table public.contribution_categories (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete restrict,
  name text not null,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint contribution_categories_name_length check (char_length(name) between 1 and 60),
  constraint contribution_categories_group_name_key unique (group_id, name),
  constraint contribution_categories_id_group_key unique (id, group_id)
);

create table public.event_contributions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null,
  group_id uuid not null,
  category_id uuid,
  user_id uuid references public.profiles (id) on delete restrict,
  household_id uuid,
  label text not null,
  status public.contribution_status not null default 'open',
  display_name text,
  assigned_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint event_contributions_label_length check (char_length(label) between 1 and 160),
  constraint event_contributions_target_check check (
    user_id is null or household_id is null
  ),
  constraint event_contributions_snapshot_check check (
    (user_id is null and household_id is null)
    or display_name is not null
  ),
  constraint event_contributions_event_fkey
    foreign key (event_id, group_id)
    references public.events (id, group_id)
    on delete restrict,
  constraint event_contributions_category_fkey
    foreign key (category_id, group_id)
    references public.contribution_categories (id, group_id)
    on delete restrict,
  constraint event_contributions_household_fkey
    foreign key (household_id, group_id)
    references public.households (id, group_id)
    on delete restrict
);

create table public.dietary_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete restrict,
  category public.dietary_category not null,
  label text not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint dietary_entries_label_length check (char_length(label) between 1 and 120),
  constraint dietary_entries_notes_length check (
    notes is null or char_length(notes) between 1 and 500
  )
);

create table public.dietary_entry_shares (
  dietary_entry_id uuid not null references public.dietary_entries (id) on delete cascade,
  group_id uuid not null references public.groups (id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (dietary_entry_id, group_id)
);

create table public.event_memories (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null,
  group_id uuid not null,
  notes text,
  menu_notes text,
  recorded_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint event_memories_event_key unique (event_id),
  constraint event_memories_notes_length check (
    notes is null or char_length(notes) between 1 and 4000
  ),
  constraint event_memories_menu_length check (
    menu_notes is null or char_length(menu_notes) between 1 and 2000
  ),
  constraint event_memories_event_fkey
    foreign key (event_id, group_id)
    references public.events (id, group_id)
    on delete restrict
);

create table public.event_memory_attendees (
  memory_id uuid not null references public.event_memories (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete restrict,
  display_name text not null,
  primary key (memory_id, user_id),
  constraint event_memory_attendees_display_name_length check (
    char_length(display_name) between 1 and 80
  )
);

create or replace function public.create_default_group_settings()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  -- Every group has one settings row. There is no client insert policy, so
  -- this definer function is the only insert path.
  insert into public.group_settings (group_id) values (new.id);
  return new;
end;
$function$;

create or replace function public.groups_before_write()
returns trigger
language plpgsql
set search_path = public
as $function$
begin
  if tg_op = 'UPDATE'
     and new.owner_id is distinct from old.owner_id
     and not public.running_as_table_owner('public.groups'::regclass)
  then
    raise exception 'groups.owner_id changes through ownership transfer';
  end if;
  return new;
end;
$function$;

create or replace function public.memberships_before_write()
returns trigger
language plpgsql
set search_path = public
as $function$
declare
  v_owner uuid;
begin
  if tg_op = 'UPDATE' then
    if new.group_id is distinct from old.group_id
       or new.user_id is distinct from old.user_id
    then
      raise exception 'membership group and user are immutable';
    end if;
  end if;

  if new.status = 'active' then
    new.removed_at = null;
  elsif new.removed_at is null then
    new.removed_at = now();
  end if;

  if tg_op = 'INSERT' and new.role = 'owner' then
    select g.owner_id into v_owner
    from public.groups g
    where g.id = new.group_id;
    if v_owner is distinct from new.user_id then
      raise exception 'owner membership must match groups.owner_id';
    end if;
  end if;

  if tg_op = 'UPDATE'
     and (old.role = 'owner' or new.role = 'owner')
     and (
       new.role is distinct from old.role
       or new.status is distinct from old.status
     )
     and not public.running_as_table_owner('public.group_memberships'::regclass)
  then
    raise exception 'only ownership transfer can change the owner membership';
  end if;

  return new;
end;
$function$;

create or replace function public.memberships_after_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_action public.membership_change_action;
begin
  -- SECURITY DEFINER: audit rows are not client-insertable, and owner_id is
  -- updated as the table owner so a member cannot set that column directly.
  if new.role = 'owner' and new.status = 'active' then
    update public.groups
    set owner_id = new.user_id
    where id = new.group_id
      and owner_id is distinct from new.user_id;
  end if;

  if tg_op = 'INSERT' then
    v_action := 'joined';
  elsif new.status = 'removed' and old.status is distinct from 'removed' then
    v_action := 'removed';
  elsif new.status = 'active' and old.status = 'removed' then
    v_action := 'restored';
  elsif new.role is distinct from old.role then
    v_action := 'role_changed';
  else
    return null;
  end if;

  insert into public.membership_changes (
    group_id,
    subject_user_id,
    actor_user_id,
    action,
    previous_role,
    new_role,
    previous_status,
    new_status
  ) values (
    new.group_id,
    new.user_id,
    auth.uid(),
    v_action,
    case when tg_op = 'UPDATE' then old.role else null end,
    new.role,
    case when tg_op = 'UPDATE' then old.status else null end,
    new.status
  );

  return null;
end;
$function$;

create or replace function public.events_before_write()
returns trigger
language plpgsql
set search_path = public
as $function$
begin
  if tg_op = 'UPDATE' then
    if new.group_id is distinct from old.group_id
       or new.created_by is distinct from old.created_by
       or new.recurrence_series_id is distinct from old.recurrence_series_id
    then
      raise exception 'event group, creator, and series link are immutable';
    end if;
  end if;
  return new;
end;
$function$;

create or replace function public.candidates_before_write()
returns trigger
language plpgsql
set search_path = public
as $function$
begin
  if tg_op = 'UPDATE' then
    new.event_id = old.event_id;
    new.group_id = old.group_id;
    new.proposed_by = old.proposed_by;
    return new;
  end if;

  select e.group_id into new.group_id
  from public.events e
  where e.id = new.event_id;

  if new.group_id is null then
    raise exception 'event not found';
  end if;
  return new;
end;
$function$;

create or replace function public.responses_before_write()
returns trigger
language plpgsql
set search_path = public
as $function$
begin
  if tg_op = 'UPDATE' then
    new.candidate_id = old.candidate_id;
    new.event_id = old.event_id;
    new.group_id = old.group_id;
    new.user_id = old.user_id;
  else
    select c.event_id, c.group_id
    into new.event_id, new.group_id
    from public.event_candidates c
    where c.id = new.candidate_id;

    if new.group_id is null then
      raise exception 'candidate not found';
    end if;
  end if;

  if not exists (
    select 1
    from public.group_memberships m
    where m.group_id = new.group_id
      and m.user_id = new.user_id
      and m.status = 'active'
  ) then
    raise exception 'responses require an active group member';
  end if;

  if new.response = 'maybe' and not exists (
    select 1
    from public.group_settings s
    where s.group_id = new.group_id
      and s.maybe_responses_enabled
  ) then
    raise exception 'maybe responses are disabled for this group';
  end if;

  return new;
end;
$function$;

create or replace function public.hosts_before_write()
returns trigger
language plpgsql
set search_path = public
as $function$
declare
  v_name text;
begin
  if tg_op = 'UPDATE' then
    new.event_id = old.event_id;
    new.group_id = old.group_id;
    new.user_id = old.user_id;
    new.household_id = old.household_id;
    new.display_name = old.display_name;
    new.assigned_by = old.assigned_by;
    if new.status is distinct from old.status
       and new.status <> 'proposed'
       and new.responded_at is null
    then
      new.responded_at = now();
    end if;
    return new;
  end if;

  select e.group_id into new.group_id
  from public.events e
  where e.id = new.event_id;

  if new.group_id is null then
    raise exception 'event not found';
  end if;

  if new.user_id is not null then
    if not exists (
      select 1
      from public.group_memberships m
      where m.group_id = new.group_id
        and m.user_id = new.user_id
        and m.status = 'active'
    ) then
      raise exception 'host must be an active group member';
    end if;
    select p.display_name into v_name
    from public.profiles p
    where p.id = new.user_id;
  else
    select h.name into v_name
    from public.households h
    where h.id = new.household_id
      and h.group_id = new.group_id;
  end if;

  if v_name is null then
    raise exception 'host display name could not be recorded';
  end if;
  new.display_name = v_name;
  return new;
end;
$function$;

create or replace function public.contributions_before_write()
returns trigger
language plpgsql
set search_path = public
as $function$
declare
  v_name text;
begin
  if tg_op = 'UPDATE' then
    new.event_id = old.event_id;
    new.group_id = old.group_id;
    new.assigned_by = old.assigned_by;
    if old.user_id is not null then
      new.user_id = old.user_id;
    end if;
    if old.household_id is not null then
      new.household_id = old.household_id;
    end if;
    if new.user_id is not distinct from old.user_id
       and new.household_id is not distinct from old.household_id
    then
      new.display_name = old.display_name;
      return new;
    end if;
  else
    select e.group_id into new.group_id
    from public.events e
    where e.id = new.event_id;
    if new.group_id is null then
      raise exception 'event not found';
    end if;
  end if;

  if new.user_id is not null then
    if not exists (
      select 1
      from public.group_memberships m
      where m.group_id = new.group_id
        and m.user_id = new.user_id
        and m.status = 'active'
    ) then
      raise exception 'contribution assignee must be an active group member';
    end if;
    select p.display_name into v_name
    from public.profiles p
    where p.id = new.user_id;
    new.display_name = v_name;
  elsif new.household_id is not null then
    select h.name into v_name
    from public.households h
    where h.id = new.household_id
      and h.group_id = new.group_id;
    new.display_name = v_name;
  else
    new.display_name = null;
  end if;

  if (new.user_id is not null or new.household_id is not null) and new.display_name is null then
    raise exception 'contribution display name could not be recorded';
  end if;
  return new;
end;
$function$;

create or replace function public.household_members_before_write()
returns trigger
language plpgsql
set search_path = public
as $function$
begin
  select h.group_id into new.group_id
  from public.households h
  where h.id = new.household_id;

  if new.group_id is null then
    raise exception 'household not found';
  end if;

  if not exists (
    select 1
    from public.group_memberships m
    where m.group_id = new.group_id
      and m.user_id = new.user_id
      and m.status = 'active'
  ) then
    raise exception 'household members must be active group members';
  end if;
  return new;
end;
$function$;

create or replace function public.memories_before_write()
returns trigger
language plpgsql
set search_path = public
as $function$
begin
  if tg_op = 'UPDATE' then
    new.event_id = old.event_id;
    new.group_id = old.group_id;
    new.recorded_by = old.recorded_by;
    return new;
  end if;

  select e.group_id into new.group_id
  from public.events e
  where e.id = new.event_id;

  if new.group_id is null then
    raise exception 'event not found';
  end if;
  return new;
end;
$function$;

create or replace function public.memory_attendees_before_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_group_id uuid;
  v_name text;
begin
  -- SECURITY DEFINER: a removed member's profile is hidden, but a memory may
  -- still snapshot the name they used. This copies one display name onto a row
  -- the caller is allowed to insert; it does not expose the profile.
  select mem.group_id into v_group_id
  from public.event_memories mem
  where mem.id = new.memory_id;

  if v_group_id is null then
    raise exception 'memory not found';
  end if;

  if not exists (
    select 1
    from public.group_memberships m
    where m.group_id = v_group_id
      and m.user_id = new.user_id
  ) then
    raise exception 'memory attendees must belong to the group';
  end if;

  if tg_op = 'INSERT' then
    select p.display_name into v_name
    from public.profiles p
    where p.id = new.user_id;
    if v_name is null then
      raise exception 'attendee profile not found';
    end if;
    new.display_name = v_name;
  else
    new.memory_id = old.memory_id;
    new.user_id = old.user_id;
    new.display_name = old.display_name;
  end if;
  return new;
end;
$function$;

create trigger groups_set_updated_at
  before update on public.groups
  for each row execute function public.set_updated_at();
create trigger groups_before_write
  before update on public.groups
  for each row execute function public.groups_before_write();
create trigger groups_create_settings
  after insert on public.groups
  for each row execute function public.create_default_group_settings();

create trigger group_settings_set_updated_at
  before update on public.group_settings
  for each row execute function public.set_updated_at();

create trigger group_memberships_set_updated_at
  before update on public.group_memberships
  for each row execute function public.set_updated_at();
create trigger group_memberships_before_write
  before insert or update on public.group_memberships
  for each row execute function public.memberships_before_write();
create trigger group_memberships_after_write
  after insert or update of role, status on public.group_memberships
  for each row execute function public.memberships_after_write();

create trigger households_set_updated_at
  before update on public.households
  for each row execute function public.set_updated_at();
create trigger household_members_before_write
  before insert on public.household_members
  for each row execute function public.household_members_before_write();

create trigger recurrence_series_set_updated_at
  before update on public.recurrence_series
  for each row execute function public.set_updated_at();

create trigger events_set_updated_at
  before update on public.events
  for each row execute function public.set_updated_at();
create trigger events_before_write
  before update on public.events
  for each row execute function public.events_before_write();

create trigger event_candidates_set_updated_at
  before update on public.event_candidates
  for each row execute function public.set_updated_at();
create trigger event_candidates_before_write
  before insert or update on public.event_candidates
  for each row execute function public.candidates_before_write();

create trigger event_responses_set_updated_at
  before update on public.event_responses
  for each row execute function public.set_updated_at();
create trigger event_responses_before_write
  before insert or update on public.event_responses
  for each row execute function public.responses_before_write();

create trigger host_assignments_set_updated_at
  before update on public.host_assignments
  for each row execute function public.set_updated_at();
create trigger host_assignments_before_write
  before insert or update on public.host_assignments
  for each row execute function public.hosts_before_write();

create trigger contribution_categories_set_updated_at
  before update on public.contribution_categories
  for each row execute function public.set_updated_at();

create trigger event_contributions_set_updated_at
  before update on public.event_contributions
  for each row execute function public.set_updated_at();
create trigger event_contributions_before_write
  before insert or update on public.event_contributions
  for each row execute function public.contributions_before_write();

create trigger dietary_entries_set_updated_at
  before update on public.dietary_entries
  for each row execute function public.set_updated_at();

create trigger event_memories_set_updated_at
  before update on public.event_memories
  for each row execute function public.set_updated_at();
create trigger event_memories_before_write
  before insert or update on public.event_memories
  for each row execute function public.memories_before_write();
create trigger event_memory_attendees_before_write
  before insert or update on public.event_memory_attendees
  for each row execute function public.memory_attendees_before_write();

create unique index group_memberships_one_active_owner
  on public.group_memberships (group_id)
  where role = 'owner' and status = 'active';

create index group_memberships_user_status_idx
  on public.group_memberships (user_id, status);

create index groups_owner_idx
  on public.groups (owner_id);

create index membership_changes_group_idx
  on public.membership_changes (group_id, created_at);

create index households_group_idx
  on public.households (group_id);

create index recurrence_series_group_idx
  on public.recurrence_series (group_id);

create index events_group_status_idx
  on public.events (group_id, status);

create index events_series_idx
  on public.events (recurrence_series_id)
  where recurrence_series_id is not null;

create index event_candidates_event_idx
  on public.event_candidates (event_id);

create unique index event_candidates_one_selected
  on public.event_candidates (event_id)
  where status = 'selected';

create index event_responses_event_idx
  on public.event_responses (event_id);

create index event_responses_user_idx
  on public.event_responses (user_id);

create index host_assignments_event_idx
  on public.host_assignments (event_id);

create unique index host_assignments_one_accepted
  on public.host_assignments (event_id)
  where status = 'accepted';

create index event_contributions_event_idx
  on public.event_contributions (event_id);

create index dietary_entries_user_idx
  on public.dietary_entries (user_id);

create index dietary_entry_shares_group_idx
  on public.dietary_entry_shares (group_id);

comment on table public.profiles is
  'Application profile for auth.users. Display name only; dietary data is not stored here.';
comment on table public.groups is
  'A gathering circle. owner_id mirrors the active owner membership.';
comment on table public.group_settings is
  'Configurable group rules. One row per group, created with the group.';
comment on table public.group_memberships is
  'Membership is retained when someone leaves (status removed) so history can keep its user reference.';
comment on table public.membership_changes is
  'Append-only membership audit. Clients cannot insert these rows.';
comment on table public.households is
  'Optional coordination unit inside a group. Attendance and dietary data stay on the person.';
comment on table public.recurrence_series is
  'Identity and simple cadence anchor for recurring gatherings. Occurrence generation is application logic.';
comment on table public.events is
  'One gathering, recurring or one-off. A one-off has no recurrence_series_id. Status transitions are application logic.';
comment on table public.event_candidates is
  'Proposed times for an event before the group agrees.';
comment on table public.event_responses is
  'Availability for one candidate. visibility group is readable by active members; private is readable only by the author while they remain active.';
comment on table public.host_assignments is
  'Host offers, acceptance, decline, and swaps. display_name is snapshotted at insert.';
comment on table public.event_contributions is
  'What someone brings. Fairness scoring is not stored here.';
comment on table public.dietary_entries is
  'Self-reported dietary labels owned by the user. Not a medical or allergen-free claim.';
comment on table public.dietary_entry_shares is
  'Explicit share of one dietary entry with one group. No share means other members cannot read it.';
comment on table public.event_memories is
  'Notes and menu for a gathering. Photos are not stored in this schema.';
comment on table public.event_memory_attendees is
  'Who was recorded at a gathering, with the display name copied at insert.';

-- Lock tables down before policies arrive. No policy means no API access.
do $rls$
declare
  t text;
begin
  foreach t in array array[
    'profiles',
    'groups',
    'group_settings',
    'group_memberships',
    'membership_changes',
    'households',
    'household_members',
    'recurrence_series',
    'events',
    'event_candidates',
    'event_responses',
    'host_assignments',
    'contribution_categories',
    'event_contributions',
    'dietary_entries',
    'dietary_entry_shares',
    'event_memories',
    'event_memory_attendees'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format('revoke all on table public.%I from public, anon', t);
  end loop;
end
$rls$;
