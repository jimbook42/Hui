-- HUI-022A: coordination model corrections (hosting, contributions, timezone, RLS).

create type public.member_hosting_standing as enum (
  'default',
  'prefer_not',
  'never'
);

alter table public.group_settings
  add column if not exists hosting_enabled boolean not null default true,
  add column if not exists avoid_consecutive_hosts boolean not null default false,
  add column if not exists timezone text not null default 'Pacific/Auckland';

alter table public.group_settings
  add constraint group_settings_timezone_length check (
    char_length(timezone) between 1 and 64
  );

comment on column public.group_settings.hosting_enabled is
  'When false, events in this group do not assign or request a host.';
comment on column public.group_settings.avoid_consecutive_hosts is
  'When true, host selection skips the member who hosted the previous confirmed gathering.';
comment on column public.group_settings.timezone is
  'IANA timezone used for wall-clock event times in this group.';

alter table public.group_memberships
  add column if not exists hosting_standing public.member_hosting_standing not null default 'default';

comment on column public.group_memberships.hosting_standing is
  'Standing hosting preference for this member in this group.';

alter table public.contribution_categories
  add column if not exists follows_host boolean not null default false,
  add column if not exists default_assignee_user_id uuid references public.profiles (id) on delete set null;

comment on column public.contribution_categories.follows_host is
  'When true, this category is assigned to the accepted host for each event.';
comment on column public.contribution_categories.default_assignee_user_id is
  'Optional standing default assignee for this category (not rewritten by one-off event changes).';

alter table public.events
  add column if not exists timezone text;

comment on column public.events.timezone is
  'IANA timezone snapshot for displaying this event after confirmation.';

create or replace function public.pick_host_candidate(
  p_group_id uuid,
  p_event_id uuid
)
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  v_avoid_consecutive boolean;
  v_last_host uuid;
  v_pick uuid;
begin
  select coalesce(gs.avoid_consecutive_hosts, false)
  into v_avoid_consecutive
  from public.group_settings gs
  where gs.group_id = p_group_id;

  if coalesce(v_avoid_consecutive, false) then
    select ha.user_id
    into v_last_host
    from public.host_assignments ha
    join public.events e on e.id = ha.event_id
    where ha.group_id = p_group_id
      and ha.status = 'accepted'
      and ha.user_id is not null
      and e.status in ('confirmed', 'completed')
      and e.id is distinct from p_event_id
    order by e.confirmed_at desc nulls last, ha.created_at desc
    limit 1;
  end if;

  select m.user_id
  into v_pick
  from public.group_memberships m
  join public.profiles p on p.id = m.user_id
  where m.group_id = p_group_id
    and m.status = 'active'
    and m.hosting_standing is distinct from 'never'
    and m.user_id is distinct from v_last_host
    and not exists (
      select 1
      from public.host_assignments ha
      where ha.event_id = p_event_id
        and ha.user_id = m.user_id
        and ha.status in ('declined', 'swapped_out')
    )
  order by
    (
      select count(*)::integer
      from public.host_assignments ha
      join public.events e on e.id = ha.event_id
      where ha.group_id = p_group_id
        and ha.user_id = m.user_id
        and ha.status = 'accepted'
        and e.status in ('confirmed', 'completed')
    ),
    p.display_name collate "C",
    m.user_id
  limit 1;

  return v_pick;
end;
$function$;

create or replace function public.propose_event_host_for_event(
  p_event_id uuid,
  p_assigned_by uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_group_id uuid;
  v_status public.event_status;
  v_hosting_enabled boolean;
  v_host_user uuid;
  v_display_name text;
  v_assignment_id uuid;
begin
  select e.group_id, e.status
  into v_group_id, v_status
  from public.events e
  where e.id = p_event_id;

  if v_group_id is null or v_status is distinct from 'confirmed' then
    return null;
  end if;

  select coalesce(gs.hosting_enabled, true)
  into v_hosting_enabled
  from public.group_settings gs
  where gs.group_id = v_group_id;

  if not coalesce(v_hosting_enabled, true) then
    return null;
  end if;

  if exists (
    select 1
    from public.host_assignments ha
    where ha.event_id = p_event_id
      and ha.status in ('proposed', 'accepted')
  ) then
    return null;
  end if;

  v_host_user := public.pick_host_candidate(v_group_id, p_event_id);
  if v_host_user is null then
    return null;
  end if;

  select p.display_name into v_display_name
  from public.profiles p
  where p.id = v_host_user;

  insert into public.host_assignments (
    event_id,
    group_id,
    user_id,
    status,
    display_name,
    assigned_by
  )
  values (
    p_event_id,
    v_group_id,
    v_host_user,
    'proposed',
    coalesce(v_display_name, 'Member'),
    coalesce(p_assigned_by, v_host_user)
  )
  returning id into v_assignment_id;

  return v_assignment_id;
end;
$function$;

create or replace function public.sync_host_bound_contributions(p_event_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_host_user uuid;
  v_display_name text;
  v_group_id uuid;
begin
  select ha.user_id, ha.display_name, ha.group_id
  into v_host_user, v_display_name, v_group_id
  from public.host_assignments ha
  where ha.event_id = p_event_id
    and ha.status = 'accepted'
    and ha.user_id is not null
  order by ha.created_at desc
  limit 1;

  if v_host_user is null then
    update public.event_contributions ec
    set
      user_id = null,
      display_name = null,
      status = 'open'
    from public.contribution_categories c
    where ec.event_id = p_event_id
      and ec.category_id = c.id
      and c.follows_host = true
      and ec.group_id = v_group_id;
    return;
  end if;

  update public.event_contributions ec
  set
    user_id = v_host_user,
    display_name = v_display_name,
    status = 'accepted'
  from public.contribution_categories c
  where ec.event_id = p_event_id
    and ec.category_id = c.id
    and c.follows_host = true
    and ec.group_id = v_group_id;
end;
$function$;

create or replace function public.seed_event_contributions(p_event_id uuid, p_actor uuid)
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
  r record;
begin
  select e.group_id, e.status
  into v_group_id, v_status
  from public.events e
  where e.id = p_event_id;

  if v_group_id is null or v_status not in ('confirmed', 'proposing') then
    return;
  end if;

  select ha.user_id, ha.display_name
  into v_host_user, v_host_name
  from public.host_assignments ha
  where ha.event_id = p_event_id
    and ha.status in ('proposed', 'accepted')
    and ha.user_id is not null
  order by case ha.status when 'accepted' then 0 else 1 end, ha.created_at desc
  limit 1;

  for r in
    select c.id, c.name, c.follows_host, c.default_assignee_user_id
    from public.contribution_categories c
    where c.group_id = v_group_id
      and c.archived_at is null
  loop
    if exists (
      select 1
      from public.event_contributions ec
      where ec.event_id = p_event_id
        and ec.category_id = r.id
    ) then
      continue;
    end if;

    if r.follows_host then
      if v_host_user is null then
        insert into public.event_contributions (
          event_id, group_id, category_id, user_id, label, status, assigned_by
        )
        values (
          p_event_id, v_group_id, r.id, null, r.name, 'open', coalesce(p_actor, v_host_user)
        );
      else
        insert into public.event_contributions (
          event_id, group_id, category_id, user_id, label, status, display_name, assigned_by
        )
        values (
          p_event_id,
          v_group_id,
          r.id,
          v_host_user,
          r.name,
          case
            when exists (
              select 1 from public.host_assignments ha
              where ha.event_id = p_event_id and ha.status = 'accepted' and ha.user_id = v_host_user
            ) then 'accepted'::public.contribution_status
            else 'open'::public.contribution_status
          end,
          v_host_name,
          coalesce(p_actor, v_host_user)
        );
      end if;
    elsif r.default_assignee_user_id is not null then
      insert into public.event_contributions (
        event_id,
        group_id,
        category_id,
        user_id,
        label,
        status,
        display_name,
        assigned_by
      )
      select
        p_event_id,
        v_group_id,
        r.id,
        r.default_assignee_user_id,
        r.name,
        'accepted'::public.contribution_status,
        p.display_name,
        coalesce(p_actor, r.default_assignee_user_id)
      from public.profiles p
      where p.id = r.default_assignee_user_id;
    else
      insert into public.event_contributions (
        event_id, group_id, category_id, user_id, label, status, assigned_by
      )
      values (
        p_event_id, v_group_id, r.id, null, r.name, 'open', coalesce(p_actor, p_actor)
      );
    end if;
  end loop;
end;
$function$;

create or replace function public.assign_event_host(
  p_event_id uuid,
  p_user_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_user uuid := auth.uid();
  v_group_id uuid;
  v_created_by uuid;
  v_event_status public.event_status;
  v_hosting_enabled boolean;
  v_assignment_id uuid;
  v_display_name text;
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;

  if p_user_id is null then
    raise exception 'host must be a group member';
  end if;

  select e.group_id, e.created_by, e.status
  into v_group_id, v_created_by, v_event_status
  from public.events e
  where e.id = p_event_id;

  if v_group_id is null then
    raise exception 'event not found';
  end if;

  if not public.is_active_member(v_group_id) then
    raise exception 'not an active group member';
  end if;

  select coalesce(gs.hosting_enabled, true)
  into v_hosting_enabled
  from public.group_settings gs
  where gs.group_id = v_group_id;

  if not coalesce(v_hosting_enabled, true) then
    raise exception 'hosting is disabled for this group';
  end if;

  if v_event_status = 'cancelled' then
    raise exception 'host assignment is closed for cancelled events';
  end if;

  if v_event_status <> 'confirmed' then
    raise exception 'host can only be assigned on confirmed events';
  end if;

  if not (public.is_group_admin(v_group_id) or v_created_by = v_user) then
    raise exception 'not permitted to assign a host for this event';
  end if;

  if not exists (
    select 1
    from public.group_memberships m
    where m.group_id = v_group_id
      and m.user_id = p_user_id
      and m.status = 'active'
      and m.hosting_standing is distinct from 'never'
  ) then
    raise exception 'host must be an active group member';
  end if;

  select p.display_name into v_display_name
  from public.profiles p
  where p.id = p_user_id;

  update public.host_assignments ha
  set status = 'swapped_out'
  where ha.event_id = p_event_id
    and ha.status = 'proposed';

  update public.host_assignments ha
  set status = 'swapped_out'
  where ha.event_id = p_event_id
    and ha.status = 'accepted';

  insert into public.host_assignments (
    event_id,
    group_id,
    user_id,
    status,
    display_name,
    assigned_by
  )
  values (
    p_event_id,
    v_group_id,
    p_user_id,
    'proposed',
    coalesce(v_display_name, 'Member'),
    v_user
  )
  returning id into v_assignment_id;

  perform public.sync_host_bound_contributions(p_event_id);

  return v_assignment_id;
end;
$function$;

create or replace function public.respond_to_host_assignment(
  p_event_id uuid,
  p_accept boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_user uuid := auth.uid();
  v_group_id uuid;
  v_event_status public.event_status;
  v_assignment_id uuid;
  v_updated integer;
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;

  select e.group_id, e.status
  into v_group_id, v_event_status
  from public.events e
  where e.id = p_event_id;

  if v_group_id is null then
    raise exception 'event not found';
  end if;

  if not public.is_active_member(v_group_id) then
    raise exception 'not an active group member';
  end if;

  if v_event_status = 'cancelled' then
    raise exception 'host assignment is closed for cancelled events';
  end if;

  if v_event_status <> 'confirmed' then
    raise exception 'host responses are only available on confirmed events';
  end if;

  select ha.id
  into v_assignment_id
  from public.host_assignments ha
  where ha.event_id = p_event_id
    and ha.user_id = v_user
    and ha.status = 'proposed'
  order by ha.created_at desc
  limit 1;

  if v_assignment_id is null then
    raise exception 'no pending host proposal for you on this event';
  end if;

  if p_accept then
    update public.host_assignments ha
    set status = 'swapped_out'
    where ha.event_id = p_event_id
      and ha.status = 'accepted';

    update public.host_assignments ha
    set status = 'accepted',
        responded_at = now()
    where ha.id = v_assignment_id
      and ha.user_id = v_user
      and ha.status = 'proposed';

    get diagnostics v_updated = row_count;
    if v_updated <> 1 then
      raise exception 'host acceptance failed';
    end if;

    perform public.sync_host_bound_contributions(p_event_id);
  else
    update public.host_assignments ha
    set status = 'declined',
        responded_at = now()
    where ha.id = v_assignment_id
      and ha.user_id = v_user
      and ha.status = 'proposed';

    get diagnostics v_updated = row_count;
    if v_updated <> 1 then
      raise exception 'host decline failed';
    end if;
  end if;
end;
$function$;

create or replace function public.request_host_swap(p_event_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_user uuid := auth.uid();
  v_group_id uuid;
  v_event_status public.event_status;
  v_assignment_id uuid;
  v_updated integer;
  v_next_host uuid;
  v_display_name text;
  v_new_id uuid;
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;

  select e.group_id, e.status
  into v_group_id, v_event_status
  from public.events e
  where e.id = p_event_id;

  if v_group_id is null then
    raise exception 'event not found';
  end if;

  if not public.is_active_member(v_group_id) then
    raise exception 'not an active group member';
  end if;

  if v_event_status <> 'confirmed' then
    raise exception 'host swaps are only available on confirmed events';
  end if;

  select ha.id
  into v_assignment_id
  from public.host_assignments ha
  where ha.event_id = p_event_id
    and ha.user_id = v_user
    and ha.status = 'proposed'
  order by ha.created_at desc
  limit 1;

  if v_assignment_id is null then
    raise exception 'no pending host proposal for you on this event';
  end if;

  update public.host_assignments ha
  set status = 'swapped_out',
      responded_at = now()
  where ha.id = v_assignment_id
    and ha.user_id = v_user
    and ha.status = 'proposed';

  get diagnostics v_updated = row_count;
  if v_updated <> 1 then
    raise exception 'host swap failed';
  end if;

  v_next_host := public.pick_host_candidate(v_group_id, p_event_id);
  if v_next_host is null then
    return null;
  end if;

  select p.display_name into v_display_name
  from public.profiles p
  where p.id = v_next_host;

  insert into public.host_assignments (
    event_id,
    group_id,
    user_id,
    status,
    display_name,
    assigned_by
  )
  values (
    p_event_id,
    v_group_id,
    v_next_host,
    'proposed',
    coalesce(v_display_name, 'Member'),
    v_user
  )
  returning id into v_new_id;

  perform public.sync_host_bound_contributions(p_event_id);

  return v_new_id;
end;
$function$;

create or replace function public.set_my_hosting_standing(
  p_group_id uuid,
  p_standing public.member_hosting_standing
)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_user uuid := auth.uid();
  v_updated integer;
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;

  update public.group_memberships m
  set hosting_standing = p_standing
  where m.group_id = p_group_id
    and m.user_id = v_user
    and m.status = 'active';

  get diagnostics v_updated = row_count;
  if v_updated <> 1 then
    raise exception 'membership not found';
  end if;
end;
$function$;

create or replace function public.set_member_consensus_required(
  p_group_id uuid,
  p_user_id uuid,
  p_required boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_user uuid := auth.uid();
  v_updated integer;
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;

  if not public.is_group_admin(p_group_id) then
    raise exception 'not permitted';
  end if;

  update public.group_memberships m
  set consensus_required = p_required
  where m.group_id = p_group_id
    and m.user_id = p_user_id
    and m.status = 'active';

  get diagnostics v_updated = row_count;
  if v_updated <> 1 then
    raise exception 'membership not found';
  end if;
end;
$function$;

create or replace function public.candidate_attendance_roster(p_candidate_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  v_event_id uuid;
  v_group_id uuid;
  v_viewer uuid := auth.uid();
  v_maybe_enabled boolean;
  v_members jsonb := '[]'::jsonb;
  r record;
  v_response text;
begin
  if v_viewer is null then
    raise exception 'not authenticated';
  end if;

  select c.event_id, c.group_id
  into v_event_id, v_group_id
  from public.event_candidates c
  where c.id = p_candidate_id;

  if v_event_id is null or not public.is_active_member(v_group_id) then
    raise exception 'candidate not found';
  end if;

  select gs.maybe_responses_enabled
  into v_maybe_enabled
  from public.group_settings gs
  where gs.group_id = v_group_id;

  for r in
    select m.user_id, p.display_name
    from public.group_memberships m
    join public.profiles p on p.id = m.user_id
    where m.group_id = v_group_id
      and m.status = 'active'
    order by p.display_name collate "C", m.user_id
  loop
    select er.response::text
    into v_response
    from public.event_responses er
    where er.candidate_id = p_candidate_id
      and er.user_id = r.user_id
      and (
        er.user_id = v_viewer
        or er.visibility = 'group'
      );

    v_members := v_members || jsonb_build_array(
      jsonb_build_object(
        'user_id', r.user_id,
        'display_name', r.display_name,
        'response', v_response
      )
    );
  end loop;

  return jsonb_build_object(
    'maybe_responses_enabled', coalesce(v_maybe_enabled, true),
    'members', v_members
  );
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
  perform public.propose_event_host_for_event(p_event_id, v_actor);
end;
$function$;

create or replace function public.trg_host_assignments_after_accept()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  if tg_op = 'UPDATE'
    and old.status = 'proposed'
    and new.status = 'accepted' then
    perform public.sync_host_bound_contributions(new.event_id);
  end if;
  return new;
end;
$function$;

drop trigger if exists host_assignments_after_accept on public.host_assignments;
create trigger host_assignments_after_accept
  after update of status on public.host_assignments
  for each row execute function public.trg_host_assignments_after_accept();

create or replace function public.trg_host_assignments_notifications()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_event_title text;
  v_group_name text;
begin
  select e.title, g.name
  into v_event_title, v_group_name
  from public.events e
  join public.groups g on g.id = e.group_id
  where e.id = new.event_id;

  if tg_op = 'INSERT' then
    if new.status = 'proposed' and new.user_id is not null then
      perform public.queue_member_notification(
        new.user_id,
        'host_proposed'::public.notification_kind,
        'Host request',
        format(
          'Hui has suggested you host "%s" in %s.',
          coalesce(v_event_title, 'an event'),
          coalesce(v_group_name, 'your group')
        ),
        new.group_id,
        new.event_id,
        'host_proposed:' || new.id::text
      );
    end if;
  elsif tg_op = 'UPDATE'
    and old.status = 'proposed'
    and new.status in ('accepted', 'declined', 'swapped_out')
    and new.assigned_by is not null
    and new.assigned_by is distinct from new.user_id then
    if new.status = 'accepted' then
      perform public.queue_member_notification(
        new.assigned_by,
        'host_accepted'::public.notification_kind,
        'Host accepted',
        format(
          '%s accepted hosting "%s".',
          coalesce(new.display_name, 'The host'),
          coalesce(v_event_title, 'the event')
        ),
        new.group_id,
        new.event_id,
        'host_response:' || new.id::text || ':accepted'
      );
    elsif new.status = 'declined' then
      perform public.queue_member_notification(
        new.assigned_by,
        'host_declined'::public.notification_kind,
        'Host declined',
        format(
          '%s declined hosting "%s".',
          coalesce(new.display_name, 'The host'),
          coalesce(v_event_title, 'the event')
        ),
        new.group_id,
        new.event_id,
        'host_response:' || new.id::text || ':declined'
      );
    elsif new.status = 'swapped_out' and old.status = 'proposed' then
      perform public.queue_member_notification(
        new.assigned_by,
        'host_declined'::public.notification_kind,
        'Host swap requested',
        format(
          '%s asked to swap hosting for "%s".',
          coalesce(new.display_name, 'The host'),
          coalesce(v_event_title, 'the event')
        ),
        new.group_id,
        new.event_id,
        'host_response:' || new.id::text || ':swapped'
      );
    end if;
  end if;

  return new;
end;
$function$;

drop policy if exists events_update on public.events;
create policy events_update
  on public.events
  for update
  to authenticated
  using (
    public.is_active_member(group_id)
    and (
      public.is_group_admin(group_id)
      or created_by = (select auth.uid())
    )
  )
  with check (
    public.is_active_member(group_id)
    and (
      public.is_group_admin(group_id)
      or created_by = (select auth.uid())
    )
  );

drop policy if exists event_candidates_update on public.event_candidates;
create policy event_candidates_update
  on public.event_candidates
  for update
  to authenticated
  using (
    public.is_active_member(group_id)
    and (
      public.is_group_admin(group_id)
      or proposed_by = (select auth.uid())
      or exists (
        select 1
        from public.events e
        where e.id = event_candidates.event_id
          and e.created_by = (select auth.uid())
      )
    )
  )
  with check (
    public.is_active_member(group_id)
    and (
      public.is_group_admin(group_id)
      or proposed_by = (select auth.uid())
      or exists (
        select 1
        from public.events e
        where e.id = event_candidates.event_id
          and e.created_by = (select auth.uid())
      )
    )
  );

-- Scheduling triggers must not take FOR UPDATE on events: members who can respond
-- are not always permitted to update the event row under RLS.
create or replace function public.candidates_before_write()
returns trigger
language plpgsql
set search_path = public
as $function$
declare
  v_event_status public.event_status;
begin
  if tg_op = 'UPDATE' then
    new.event_id = old.event_id;
    new.group_id = old.group_id;
    new.proposed_by = old.proposed_by;
  else
    select e.group_id into new.group_id
    from public.events e
    where e.id = new.event_id;

    if new.group_id is null then
      raise exception 'event not found';
    end if;
  end if;

  select e.status into v_event_status
  from public.events e
  where e.id = new.event_id;

  if v_event_status is null then
    raise exception 'event not found';
  end if;

  if v_event_status in ('confirmed', 'completed', 'cancelled') then
    raise exception 'this event is no longer open for scheduling changes';
  end if;

  if new.status = 'selected'
     and (tg_op = 'INSERT' or old.status is distinct from 'selected')
     and not public.running_as_table_owner('public.event_candidates'::regclass)
  then
    raise exception 'candidates are selected only by finalisation';
  end if;

  return new;
end;
$function$;

create or replace function public.responses_before_write()
returns trigger
language plpgsql
set search_path = public
as $function$
declare
  v_event_status public.event_status;
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

  select e.status into v_event_status
  from public.events e
  where e.id = new.event_id;

  if v_event_status is null then
    raise exception 'event not found';
  end if;

  if v_event_status in ('confirmed', 'completed', 'cancelled') then
    raise exception 'this event is no longer open for scheduling changes';
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

revoke all on function public.pick_host_candidate(uuid, uuid) from public, anon;
revoke all on function public.propose_event_host_for_event(uuid, uuid) from public, anon;
revoke all on function public.sync_host_bound_contributions(uuid) from public, anon;
revoke all on function public.seed_event_contributions(uuid, uuid) from public, anon;
revoke all on function public.request_host_swap(uuid) from public, anon;
revoke all on function public.set_my_hosting_standing(uuid, public.member_hosting_standing) from public, anon;
revoke all on function public.set_member_consensus_required(uuid, uuid, boolean) from public, anon;
revoke all on function public.candidate_attendance_roster(uuid) from public, anon;

grant execute on function public.pick_host_candidate(uuid, uuid) to authenticated, service_role;
grant execute on function public.propose_event_host_for_event(uuid, uuid) to authenticated, service_role;
grant execute on function public.sync_host_bound_contributions(uuid) to authenticated, service_role;
grant execute on function public.seed_event_contributions(uuid, uuid) to authenticated, service_role;
grant execute on function public.request_host_swap(uuid) to authenticated, service_role;
grant execute on function public.set_my_hosting_standing(uuid, public.member_hosting_standing) to authenticated, service_role;
grant execute on function public.set_member_consensus_required(uuid, uuid, boolean) to authenticated, service_role;
grant execute on function public.candidate_attendance_roster(uuid) to authenticated, service_role;

comment on function public.assign_event_host(uuid, uuid) is
  'Event proposer or group admin proposes a member as host. The member must accept before hosting is final.';
comment on function public.request_host_swap(uuid) is
  'Proposed host cannot host this time; Hui selects another suitable member and preserves history.';
comment on function public.candidate_attendance_roster(uuid) is
  'Member-visible attendance names for one candidate. Private responses stay hidden from other members.';
