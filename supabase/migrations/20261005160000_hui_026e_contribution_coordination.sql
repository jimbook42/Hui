-- HUI-026E: coordinator assign/reassign/release, safer member claims, host-bound guardrails.

create or replace function public.assert_can_manage_event_contributions(p_event_id uuid)
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

  if v_status in ('cancelled', 'completed') then
    raise exception 'contributions are closed for this event';
  end if;

  if not (public.is_group_admin(v_group_id) or v_created_by = v_user) then
    raise exception 'not allowed to manage contributions for this event';
  end if;
end;
$function$;

create or replace function public.claim_event_contribution(
  p_event_id uuid,
  p_category_id uuid,
  p_description text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_user uuid := auth.uid();
  v_group_id uuid;
  v_event_status public.event_status;
  v_category_name text;
  v_follows_host boolean;
  v_label text;
  v_contribution_id uuid;
  v_open_id uuid;
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
    raise exception 'contributions are closed for cancelled events';
  end if;

  if v_event_status = 'completed' then
    raise exception 'contributions are closed for completed events';
  end if;

  select c.name, c.follows_host
  into v_category_name, v_follows_host
  from public.contribution_categories c
  where c.id = p_category_id
    and c.group_id = v_group_id
    and c.archived_at is null;

  if v_category_name is null then
    raise exception 'contribution category not found or inactive';
  end if;

  if v_follows_host then
    raise exception 'this category follows the host and cannot be claimed manually';
  end if;

  if exists (
    select 1
    from public.event_contributions ec
    where ec.event_id = p_event_id
      and ec.category_id = p_category_id
      and ec.status = 'accepted'
  ) then
    raise exception 'this category is already claimed for the event';
  end if;

  v_label := nullif(trim(coalesce(p_description, '')), '');
  if v_label is null then
    v_label := v_category_name;
  end if;

  if char_length(v_label) < 1 or char_length(v_label) > 160 then
    raise exception 'description must be between 1 and 160 characters when provided';
  end if;

  select ec.id
  into v_open_id
  from public.event_contributions ec
  where ec.event_id = p_event_id
    and ec.category_id = p_category_id
    and ec.status = 'open'
    and ec.user_id is null
  order by ec.created_at asc
  limit 1;

  if v_open_id is not null then
    update public.event_contributions ec
    set
      user_id = v_user,
      label = v_label,
      status = 'accepted',
      assigned_by = v_user
    where ec.id = v_open_id
    returning ec.id into v_contribution_id;
    return v_contribution_id;
  end if;

  insert into public.event_contributions (
    event_id,
    group_id,
    category_id,
    user_id,
    label,
    status,
    assigned_by
  )
  values (
    p_event_id,
    v_group_id,
    p_category_id,
    v_user,
    v_label,
    'accepted',
    v_user
  )
  returning id into v_contribution_id;

  return v_contribution_id;
end;
$function$;

create or replace function public.assign_event_contribution_as_manager(
  p_event_id uuid,
  p_category_id uuid,
  p_member_user_id uuid,
  p_description text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_actor uuid := auth.uid();
  v_group_id uuid;
  v_category_name text;
  v_follows_host boolean;
  v_label text;
  v_contribution_id uuid;
  v_existing_id uuid;
begin
  perform public.assert_can_manage_event_contributions(p_event_id);

  select e.group_id into v_group_id from public.events e where e.id = p_event_id;

  select c.name, c.follows_host
  into v_category_name, v_follows_host
  from public.contribution_categories c
  where c.id = p_category_id
    and c.group_id = v_group_id
    and c.archived_at is null;

  if v_category_name is null then
    raise exception 'contribution category not found or inactive';
  end if;

  if v_follows_host then
    raise exception 'host-bound categories follow the accepted host; assign hosting instead';
  end if;

  if not exists (
    select 1
    from public.group_memberships m
    where m.group_id = v_group_id
      and m.user_id = p_member_user_id
      and m.status = 'active'
  ) then
    raise exception 'assignee must be an active group member';
  end if;

  if exists (
    select 1
    from public.event_contributions ec
    where ec.event_id = p_event_id
      and ec.category_id = p_category_id
      and ec.status = 'accepted'
      and ec.user_id is distinct from p_member_user_id
  ) then
    raise exception 'this category already has a different assignee; reassign instead';
  end if;

  v_label := nullif(trim(coalesce(p_description, '')), '');
  if v_label is null then
    v_label := v_category_name;
  end if;

  if char_length(v_label) < 1 or char_length(v_label) > 160 then
    raise exception 'description must be between 1 and 160 characters when provided';
  end if;

  select ec.id
  into v_existing_id
  from public.event_contributions ec
  where ec.event_id = p_event_id
    and ec.category_id = p_category_id
  order by case ec.status when 'accepted' then 0 else 1 end, ec.created_at asc
  limit 1;

  if v_existing_id is not null then
    delete from public.event_contributions where id = v_existing_id;
  end if;

  insert into public.event_contributions (
    event_id,
    group_id,
    category_id,
    user_id,
    label,
    status,
    assigned_by
  )
  values (
    p_event_id,
    v_group_id,
    p_category_id,
    p_member_user_id,
    v_label,
    'accepted',
    v_actor
  )
  returning id into v_contribution_id;

  return v_contribution_id;
end;
$function$;

create or replace function public.reassign_event_contribution_as_manager(
  p_contribution_id uuid,
  p_member_user_id uuid,
  p_description text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_actor uuid := auth.uid();
  v_event_id uuid;
  v_group_id uuid;
  v_category_id uuid;
  v_category_name text;
  v_follows_host boolean;
  v_label text;
  v_new_id uuid;
begin
  if v_actor is null then
    raise exception 'not authenticated';
  end if;

  select ec.event_id, ec.group_id, ec.category_id
  into v_event_id, v_group_id, v_category_id
  from public.event_contributions ec
  where ec.id = p_contribution_id;

  if v_event_id is null then
    raise exception 'contribution not found';
  end if;

  perform public.assert_can_manage_event_contributions(v_event_id);

  select c.name, c.follows_host
  into v_category_name, v_follows_host
  from public.contribution_categories c
  where c.id = v_category_id
    and c.group_id = v_group_id;

  if v_follows_host then
    raise exception 'host-bound categories follow the accepted host; change hosting instead';
  end if;

  if not exists (
    select 1
    from public.group_memberships m
    where m.group_id = v_group_id
      and m.user_id = p_member_user_id
      and m.status = 'active'
  ) then
    raise exception 'assignee must be an active group member';
  end if;

  v_label := nullif(trim(coalesce(p_description, '')), '');
  if v_label is null then
    v_label := coalesce(v_category_name, 'Contribution');
  end if;

  if char_length(v_label) < 1 or char_length(v_label) > 160 then
    raise exception 'description must be between 1 and 160 characters when provided';
  end if;

  delete from public.event_contributions where id = p_contribution_id;

  insert into public.event_contributions (
    event_id,
    group_id,
    category_id,
    user_id,
    label,
    status,
    assigned_by
  )
  values (
    v_event_id,
    v_group_id,
    v_category_id,
    p_member_user_id,
    v_label,
    'accepted',
    v_actor
  )
  returning id into v_new_id;

  return v_new_id;
end;
$function$;

create or replace function public.release_event_contribution_as_manager(p_contribution_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_event_id uuid;
  v_group_id uuid;
  v_category_id uuid;
  v_category_name text;
  v_follows_host boolean;
  v_deleted integer;
begin
  select ec.event_id, ec.group_id, ec.category_id
  into v_event_id, v_group_id, v_category_id
  from public.event_contributions ec
  where ec.id = p_contribution_id;

  if v_event_id is null then
    raise exception 'contribution not found';
  end if;

  perform public.assert_can_manage_event_contributions(v_event_id);

  select c.name, c.follows_host
  into v_category_name, v_follows_host
  from public.contribution_categories c
  where c.id = v_category_id
    and c.group_id = v_group_id;

  delete from public.event_contributions where id = p_contribution_id;
  get diagnostics v_deleted = row_count;
  if v_deleted <> 1 then
    raise exception 'contribution not found';
  end if;

  if v_follows_host then
    perform public.sync_host_bound_contributions(v_event_id);
    return;
  end if;

  if v_category_name is not null then
    insert into public.event_contributions (
      event_id, group_id, category_id, user_id, label, status, assigned_by
    )
    values (
      v_event_id,
      v_group_id,
      v_category_id,
      null,
      v_category_name,
      'open',
      auth.uid()
    );
  end if;
end;
$function$;

comment on function public.assert_can_manage_event_contributions(uuid) is
  'Event creator or group admin/owner while the event is open for coordination.';
comment on function public.assign_event_contribution_as_manager(uuid, uuid, uuid, text) is
  'Assign an open contribution category to a member (not host-bound categories).';
comment on function public.reassign_event_contribution_as_manager(uuid, uuid, text) is
  'Replace the assignee on an existing event contribution.';
comment on function public.release_event_contribution_as_manager(uuid) is
  'Clear an assignment; host-bound rows are re-synced to the accepted host.';

revoke all on function public.assert_can_manage_event_contributions(uuid) from public, anon;
revoke all on function public.assign_event_contribution_as_manager(uuid, uuid, uuid, text) from public, anon;
revoke all on function public.reassign_event_contribution_as_manager(uuid, uuid, text) from public, anon;
revoke all on function public.release_event_contribution_as_manager(uuid) from public, anon;

grant execute on function public.assert_can_manage_event_contributions(uuid) to authenticated, service_role;
grant execute on function public.assign_event_contribution_as_manager(uuid, uuid, uuid, text) to authenticated, service_role;
grant execute on function public.reassign_event_contribution_as_manager(uuid, uuid, text) to authenticated, service_role;
grant execute on function public.release_event_contribution_as_manager(uuid) to authenticated, service_role;
