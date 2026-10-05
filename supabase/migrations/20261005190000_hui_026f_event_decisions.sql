-- HUI-026F: generic single-choice decision polls on events.

create type public.event_decision_status as enum ('open', 'decided', 'cancelled');

create table public.event_decisions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null,
  group_id uuid not null,
  question text not null,
  status public.event_decision_status not null default 'open',
  created_by uuid not null references public.profiles (id) on delete restrict,
  selected_option_id uuid,
  decided_by uuid references public.profiles (id) on delete restrict,
  decided_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint event_decisions_question_length check (char_length(question) between 1 and 200),
  constraint event_decisions_event_fkey
    foreign key (event_id, group_id)
    references public.events (id, group_id)
    on delete cascade,
  constraint event_decisions_decided_fields_check check (
    (status = 'decided' and selected_option_id is not null and decided_by is not null and decided_at is not null)
    or (status <> 'decided' and selected_option_id is null and decided_by is null and decided_at is null)
  ),
  constraint event_decisions_cancelled_at_check check (
    (status = 'cancelled' and cancelled_at is not null)
    or (status <> 'cancelled' and cancelled_at is null)
  )
);

create table public.event_decision_options (
  id uuid primary key default gen_random_uuid(),
  decision_id uuid not null references public.event_decisions (id) on delete cascade,
  label text not null,
  position smallint not null default 0,
  created_at timestamptz not null default now(),
  constraint event_decision_options_label_length check (char_length(label) between 1 and 120),
  constraint event_decision_options_position_nonneg check (position >= 0)
);

alter table public.event_decisions
  add constraint event_decisions_selected_option_fkey
    foreign key (selected_option_id)
    references public.event_decision_options (id)
    on delete restrict;

create table public.event_decision_responses (
  id uuid primary key default gen_random_uuid(),
  decision_id uuid not null references public.event_decisions (id) on delete cascade,
  option_id uuid not null references public.event_decision_options (id) on delete restrict,
  user_id uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint event_decision_responses_one_per_member unique (decision_id, user_id)
);

create index event_decisions_event_idx on public.event_decisions (event_id);
create index event_decision_options_decision_idx on public.event_decision_options (decision_id);
create index event_decision_responses_decision_idx on public.event_decision_responses (decision_id);

create trigger event_decisions_set_updated_at
  before update on public.event_decisions
  for each row execute function public.set_updated_at();

create trigger event_decision_responses_set_updated_at
  before update on public.event_decision_responses
  for each row execute function public.set_updated_at();

comment on table public.event_decisions is
  'Group decisions on an event (restaurant, activity, etc.) — single-choice polls the manager can finalise.';

-- Cascade delete when an event is hard-deleted (HUI-026D).
create or replace function public._delete_event_cascade(p_event_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $function$
begin
  delete from public.event_memory_attendees
  where memory_id in (
    select em.id from public.event_memories em where em.event_id = p_event_id
  );

  delete from public.event_memories where event_id = p_event_id;
  delete from public.event_decision_responses
  where decision_id in (select ed.id from public.event_decisions ed where ed.event_id = p_event_id);
  delete from public.event_decision_options
  where decision_id in (select ed.id from public.event_decisions ed where ed.event_id = p_event_id);
  delete from public.event_decisions where event_id = p_event_id;
  delete from public.event_responses where event_id = p_event_id;
  delete from public.event_contributions where event_id = p_event_id;
  delete from public.host_assignments where event_id = p_event_id;
  delete from public.event_candidates where event_id = p_event_id;
  delete from public.events where id = p_event_id;
end;
$function$;

create or replace function public.assert_can_manage_event_decisions(p_event_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_user uuid := auth.uid();
  v_group_id uuid;
  v_created_by uuid;
  v_status public.event_status;
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

  if not public.is_active_member(v_group_id) then
    raise exception 'not an active group member';
  end if;

  if v_status in ('cancelled', 'completed', 'draft') then
    raise exception 'decisions are closed for this event';
  end if;

  if not (public.is_group_admin(v_group_id) or v_created_by = v_user) then
    raise exception 'not allowed to manage decisions for this event';
  end if;
end;
$function$;

create or replace function public.create_event_decision(
  p_event_id uuid,
  p_question text,
  p_option_labels text[]
)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_user uuid := auth.uid();
  v_group_id uuid;
  v_decision_id uuid;
  v_label text;
  v_pos smallint := 0;
begin
  perform public.assert_can_manage_event_decisions(p_event_id);

  p_question := nullif(trim(coalesce(p_question, '')), '');
  if p_question is null or char_length(p_question) < 1 or char_length(p_question) > 200 then
    raise exception 'question must be between 1 and 200 characters';
  end if;

  if p_option_labels is null or array_length(p_option_labels, 1) is null or array_length(p_option_labels, 1) < 2 then
    raise exception 'at least two options are required';
  end if;

  if array_length(p_option_labels, 1) > 12 then
    raise exception 'at most twelve options are allowed';
  end if;

  select e.group_id into v_group_id from public.events e where e.id = p_event_id;

  insert into public.event_decisions (event_id, group_id, question, created_by)
  values (p_event_id, v_group_id, p_question, v_user)
  returning id into v_decision_id;

  foreach v_label in array p_option_labels loop
    v_label := nullif(trim(coalesce(v_label, '')), '');
    if v_label is null or char_length(v_label) < 1 or char_length(v_label) > 120 then
      raise exception 'each option must be between 1 and 120 characters';
    end if;
    insert into public.event_decision_options (decision_id, label, position)
    values (v_decision_id, v_label, v_pos);
    v_pos := v_pos + 1;
  end loop;

  return v_decision_id;
end;
$function$;

create or replace function public.update_event_decision_draft(
  p_decision_id uuid,
  p_question text,
  p_option_labels text[]
)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_event_id uuid;
  v_status public.event_decision_status;
  v_response_count int;
  v_label text;
  v_pos smallint := 0;
begin
  select ed.event_id, ed.status
  into v_event_id, v_status
  from public.event_decisions ed
  where ed.id = p_decision_id;

  if v_event_id is null then
    raise exception 'decision not found';
  end if;

  perform public.assert_can_manage_event_decisions(v_event_id);

  if v_status <> 'open' then
    raise exception 'only open decisions can be edited';
  end if;

  select count(*)::int into v_response_count
  from public.event_decision_responses r
  where r.decision_id = p_decision_id;

  if v_response_count > 0 then
    raise exception 'cannot edit a decision after members have responded';
  end if;

  p_question := nullif(trim(coalesce(p_question, '')), '');
  if p_question is null or char_length(p_question) < 1 or char_length(p_question) > 200 then
    raise exception 'question must be between 1 and 200 characters';
  end if;

  if p_option_labels is null or array_length(p_option_labels, 1) is null or array_length(p_option_labels, 1) < 2 then
    raise exception 'at least two options are required';
  end if;

  if array_length(p_option_labels, 1) > 12 then
    raise exception 'at most twelve options are allowed';
  end if;

  update public.event_decisions ed
  set question = p_question
  where ed.id = p_decision_id;

  delete from public.event_decision_options o where o.decision_id = p_decision_id;

  foreach v_label in array p_option_labels loop
    v_label := nullif(trim(coalesce(v_label, '')), '');
    if v_label is null or char_length(v_label) < 1 or char_length(v_label) > 120 then
      raise exception 'each option must be between 1 and 120 characters';
    end if;
    insert into public.event_decision_options (decision_id, label, position)
    values (p_decision_id, v_label, v_pos);
    v_pos := v_pos + 1;
  end loop;
end;
$function$;

create or replace function public.respond_event_decision(
  p_decision_id uuid,
  p_option_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_user uuid := auth.uid();
  v_group_id uuid;
  v_status public.event_decision_status;
  v_event_status public.event_status;
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;

  select ed.group_id, ed.status, e.status
  into v_group_id, v_status, v_event_status
  from public.event_decisions ed
  join public.events e on e.id = ed.event_id
  where ed.id = p_decision_id;

  if v_group_id is null then
    raise exception 'decision not found';
  end if;

  if not public.is_active_member(v_group_id) then
    raise exception 'not an active group member';
  end if;

  if v_event_status in ('cancelled', 'completed', 'draft') then
    raise exception 'decisions are closed for this event';
  end if;

  if v_status <> 'open' then
    raise exception 'this decision is no longer open for responses';
  end if;

  if not exists (
    select 1
    from public.event_decision_options o
    where o.id = p_option_id and o.decision_id = p_decision_id
  ) then
    raise exception 'option does not belong to this decision';
  end if;

  insert into public.event_decision_responses (decision_id, option_id, user_id)
  values (p_decision_id, p_option_id, v_user)
  on conflict (decision_id, user_id) do update
    set option_id = excluded.option_id,
        updated_at = now();
end;
$function$;

create or replace function public.finalize_event_decision(
  p_decision_id uuid,
  p_option_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_event_id uuid;
  v_status public.event_decision_status;
begin
  select ed.event_id, ed.status
  into v_event_id, v_status
  from public.event_decisions ed
  where ed.id = p_decision_id;

  if v_event_id is null then
    raise exception 'decision not found';
  end if;

  perform public.assert_can_manage_event_decisions(v_event_id);

  if v_status <> 'open' then
    raise exception 'only open decisions can be finalised';
  end if;

  if not exists (
    select 1
    from public.event_decision_options o
    where o.id = p_option_id and o.decision_id = p_decision_id
  ) then
    raise exception 'option does not belong to this decision';
  end if;

  update public.event_decisions ed
  set
    status = 'decided',
    selected_option_id = p_option_id,
    decided_by = auth.uid(),
    decided_at = now()
  where ed.id = p_decision_id;
end;
$function$;

create or replace function public.cancel_event_decision(p_decision_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_event_id uuid;
  v_status public.event_decision_status;
begin
  select ed.event_id, ed.status
  into v_event_id, v_status
  from public.event_decisions ed
  where ed.id = p_decision_id;

  if v_event_id is null then
    raise exception 'decision not found';
  end if;

  perform public.assert_can_manage_event_decisions(v_event_id);

  if v_status <> 'open' then
    raise exception 'only open decisions can be cancelled';
  end if;

  update public.event_decisions ed
  set status = 'cancelled', cancelled_at = now()
  where ed.id = p_decision_id;
end;
$function$;

revoke all on function public.assert_can_manage_event_decisions(uuid) from public, anon, authenticated;

grant execute on function public.create_event_decision(uuid, text, text[]) to authenticated, service_role;
grant execute on function public.update_event_decision_draft(uuid, text, text[]) to authenticated, service_role;
grant execute on function public.respond_event_decision(uuid, uuid) to authenticated, service_role;
grant execute on function public.finalize_event_decision(uuid, uuid) to authenticated, service_role;
grant execute on function public.cancel_event_decision(uuid) to authenticated, service_role;

alter table public.event_decisions enable row level security;
alter table public.event_decision_options enable row level security;
alter table public.event_decision_responses enable row level security;

alter table public.event_decisions force row level security;
alter table public.event_decision_options force row level security;
alter table public.event_decision_responses force row level security;

create policy event_decisions_select
  on public.event_decisions
  for select
  to authenticated
  using (public.is_active_member(group_id));

create policy event_decision_options_select
  on public.event_decision_options
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.event_decisions ed
      where ed.id = event_decision_options.decision_id
        and public.is_active_member(ed.group_id)
    )
  );

create policy event_decision_responses_select
  on public.event_decision_responses
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.event_decisions ed
      where ed.id = event_decision_responses.decision_id
        and public.is_active_member(ed.group_id)
    )
  );

revoke all on table public.event_decisions from public, anon, authenticated;
revoke all on table public.event_decision_options from public, anon, authenticated;
revoke all on table public.event_decision_responses from public, anon, authenticated;

grant select on table public.event_decisions to authenticated;
grant select on table public.event_decision_options to authenticated;
grant select on table public.event_decision_responses to authenticated;

grant all on table public.event_decisions to service_role;
grant all on table public.event_decision_options to service_role;
grant all on table public.event_decision_responses to service_role;
