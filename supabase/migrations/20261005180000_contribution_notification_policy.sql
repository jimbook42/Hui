-- Contribution coordination: targeted in-app notifications; selective Web Push.
-- Push is reserved for manager assignment when the assignee needs to know now.
-- Release, clear, member claims, and rapid churn stay in the notification centre only.

drop function if exists public.queue_member_notification(
  uuid,
  public.notification_kind,
  text,
  text,
  uuid,
  uuid,
  text
);

create or replace function public.queue_member_notification(
  p_user_id uuid,
  p_kind public.notification_kind,
  p_title text,
  p_body text,
  p_group_id uuid,
  p_event_id uuid,
  p_dedupe_key text,
  p_deliver_push boolean default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_id uuid;
  v_push_enabled boolean;
begin
  if p_user_id is null or p_group_id is null or p_dedupe_key is null then
    return null;
  end if;

  if pg_catalog.char_length(pg_catalog.btrim(coalesce(p_title, ''::text))) < 1
     or pg_catalog.char_length(pg_catalog.btrim(coalesce(p_body, ''::text))) < 1 then
    return null;
  end if;

  if not exists (
    select 1
    from public.group_memberships m
    where m.group_id = p_group_id
      and m.user_id = p_user_id
      and m.status = 'active'
  ) then
    return null;
  end if;

  if p_event_id is not null and not exists (
    select 1
    from public.events e
    where e.id = p_event_id
      and e.group_id = p_group_id
  ) then
    return null;
  end if;

  insert into public.member_notifications (
    user_id,
    kind,
    title,
    body,
    group_id,
    event_id,
    dedupe_key
  )
  values (
    p_user_id,
    p_kind,
    pg_catalog.btrim(p_title),
    pg_catalog.btrim(p_body),
    p_group_id,
    p_event_id,
    p_dedupe_key
  )
  on conflict (user_id, dedupe_key) do nothing
  returning id into v_id;

  if v_id is not null and p_deliver_push is not false then
    select case p_kind
      when 'event_proposed' then p.push_event_proposals_enabled
      when 'consensus_ready' then p.push_consensus_ready_enabled
      when 'event_confirmed' then p.push_event_confirmed_enabled
      when 'host_proposed' then p.push_host_assignment_enabled
      when 'host_accepted' then p.push_host_assignment_enabled
      when 'host_declined' then p.push_host_assignment_enabled
      when 'contribution_changed' then p.push_contribution_changes_enabled
      else false
    end
    into v_push_enabled
    from public.profiles p
    where p.id = p_user_id
      and p.account_deleted_at is null;

    if coalesce(v_push_enabled, false) then
      insert into public.notification_push_outbox (notification_id, user_id)
      values (v_id, p_user_id);
    end if;
  end if;

  return v_id;
end;
$function$;

comment on function public.queue_member_notification(uuid, public.notification_kind, text, text, uuid, uuid, text, boolean) is
  'Idempotently enqueue one in-app notification; Web Push when p_deliver_push is not false and preferences allow.';

create or replace function public.contribution_event_push_recently(p_event_id uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.notification_push_outbox o
    join public.member_notifications n on n.id = o.notification_id
    where n.event_id = p_event_id
      and n.kind = 'contribution_changed'::public.notification_kind
      and o.created_at > pg_catalog.now() - interval '90 seconds'
  );
$$;

comment on function public.contribution_event_push_recently(uuid) is
  'True when a contribution Web Push was queued for this event within the coalescing window.';

create or replace function public.contribution_coordination_recipient_ids(
  p_event_id uuid,
  p_except_user_id uuid default null
)
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select distinct m.user_id
  from public.events e
  join public.group_memberships m on m.group_id = e.group_id
  where e.id = p_event_id
    and m.status = 'active'
    and (p_except_user_id is null or m.user_id is distinct from p_except_user_id)
    and (
      m.user_id = e.created_by
      or m.role in ('owner', 'admin')
    );
$$;

create or replace function public._contribution_actor_display_name(p_user_id uuid)
returns text
language sql
stable
set search_path = ''
as $$
  select coalesce(
    nullif(pg_catalog.btrim(p.display_name), ''::text),
    'A member'
  )
  from public.profiles p
  where p.id = p_user_id;
$$;

create or replace function public.notify_contribution_coordination(
  p_event_id uuid,
  p_actor_id uuid,
  p_dedupe_key text,
  p_body text
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_group_id uuid;
  v_recipient uuid;
begin
  select e.group_id into v_group_id from public.events e where e.id = p_event_id;
  if v_group_id is null then
    return;
  end if;

  for v_recipient in
    select public.contribution_coordination_recipient_ids(p_event_id, p_actor_id)
  loop
    perform public.queue_member_notification(
      v_recipient,
      'contribution_changed'::public.notification_kind,
      'Contribution updated',
      p_body,
      v_group_id,
      p_event_id,
      p_dedupe_key || ':coord:' || v_recipient::text,
      false
    );
  end loop;
end;
$function$;

create or replace function public.notify_contribution_manager_assignment(
  p_event_id uuid,
  p_actor_id uuid,
  p_assignee_id uuid,
  p_contribution_id uuid,
  p_label text
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_group_id uuid;
  v_event_title text;
  v_group_name text;
  v_actor_name text;
  v_assignee_body text;
  v_coord_body text;
  v_deliver_push boolean;
begin
  select e.group_id, e.title, g.name
  into v_group_id, v_event_title, v_group_name
  from public.events e
  join public.groups g on g.id = e.group_id
  where e.id = p_event_id;

  if v_group_id is null or p_assignee_id is null then
    return;
  end if;

  v_actor_name := public._contribution_actor_display_name(p_actor_id);
  v_assignee_body := pg_catalog.format(
    '%s assigned you "%s" on "%s" in %s.',
    v_actor_name,
    coalesce(p_label, 'a contribution'),
    coalesce(v_event_title, 'an event'),
    coalesce(v_group_name, 'your group')
  );
  v_coord_body := pg_catalog.format(
    '%s assigned "%s" on "%s" in %s.',
    v_actor_name,
    coalesce(p_label, 'a contribution'),
    coalesce(v_event_title, 'an event'),
    coalesce(v_group_name, 'your group')
  );

  perform public.notify_contribution_coordination(
    p_event_id,
    p_actor_id,
    'contrib:assign:' || p_contribution_id::text,
    v_coord_body
  );

  v_deliver_push :=
    p_assignee_id is distinct from p_actor_id
    and not public.contribution_event_push_recently(p_event_id);

  perform public.queue_member_notification(
    p_assignee_id,
    'contribution_changed'::public.notification_kind,
    'Contribution updated',
    v_assignee_body,
    v_group_id,
    p_event_id,
    'contrib:assign:' || p_contribution_id::text || ':assignee',
    v_deliver_push
  );
end;
$function$;

create or replace function public.notify_contribution_member_claim(
  p_event_id uuid,
  p_actor_id uuid,
  p_contribution_id uuid,
  p_label text
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_event_title text;
  v_group_name text;
  v_actor_name text;
  v_body text;
begin
  select e.title, g.name
  into v_event_title, v_group_name
  from public.events e
  join public.groups g on g.id = e.group_id
  where e.id = p_event_id;

  v_actor_name := public._contribution_actor_display_name(p_actor_id);
  v_body := pg_catalog.format(
    '%s claimed "%s" on "%s" in %s.',
    v_actor_name,
    coalesce(p_label, 'a contribution'),
    coalesce(v_event_title, 'an event'),
    coalesce(v_group_name, 'your group')
  );

  perform public.notify_contribution_coordination(
    p_event_id,
    p_actor_id,
    'contrib:claim:' || p_contribution_id::text,
    v_body
  );
end;
$function$;

create or replace function public.notify_contribution_release(
  p_event_id uuid,
  p_actor_id uuid,
  p_contribution_id uuid,
  p_label text
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_event_title text;
  v_group_name text;
  v_actor_name text;
  v_body text;
begin
  select e.title, g.name
  into v_event_title, v_group_name
  from public.events e
  join public.groups g on g.id = e.group_id
  where e.id = p_event_id;

  v_actor_name := public._contribution_actor_display_name(p_actor_id);
  v_body := pg_catalog.format(
    '%s released "%s" on "%s" in %s.',
    v_actor_name,
    coalesce(p_label, 'a contribution'),
    coalesce(v_event_title, 'an event'),
    coalesce(v_group_name, 'your group')
  );

  perform public.notify_contribution_coordination(
    p_event_id,
    p_actor_id,
    'contrib:release:' || p_contribution_id::text,
    v_body
  );
end;
$function$;

drop trigger if exists event_contributions_notifications on public.event_contributions;
drop function if exists public.trg_event_contributions_notifications();

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
  else
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
  end if;

  perform public.notify_contribution_member_claim(
    p_event_id,
    v_user,
    v_contribution_id,
    v_label
  );

  return v_contribution_id;
end;
$function$;

create or replace function public.release_event_contribution(p_contribution_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_user uuid := auth.uid();
  v_event_id uuid;
  v_label text;
  v_deleted integer;
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;

  select ec.event_id, ec.label
  into v_event_id, v_label
  from public.event_contributions ec
  join public.events e on e.id = ec.event_id
  where ec.id = p_contribution_id
    and ec.user_id = v_user
    and ec.status = 'accepted'
    and e.status not in ('cancelled', 'completed');

  if v_event_id is null then
    raise exception 'contribution not found or cannot be released';
  end if;

  delete from public.event_contributions ec
  using public.events e
  where ec.id = p_contribution_id
    and ec.event_id = e.id
    and ec.user_id = v_user
    and ec.status = 'accepted'
    and e.status not in ('cancelled', 'completed');

  get diagnostics v_deleted = row_count;
  if v_deleted <> 1 then
    raise exception 'contribution not found or cannot be released';
  end if;

  perform public.notify_contribution_release(
    v_event_id,
    v_user,
    p_contribution_id,
    v_label
  );
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

  perform public.notify_contribution_manager_assignment(
    p_event_id,
    v_actor,
    p_member_user_id,
    v_contribution_id,
    v_label
  );

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

  perform public.notify_contribution_manager_assignment(
    v_event_id,
    v_actor,
    p_member_user_id,
    v_new_id,
    v_label
  );

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
  v_label text;
  v_actor uuid := auth.uid();
  v_deleted integer;
begin
  select ec.event_id, ec.group_id, ec.category_id, ec.label
  into v_event_id, v_group_id, v_category_id, v_label
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

  perform public.notify_contribution_release(
    v_event_id,
    v_actor,
    p_contribution_id,
    coalesce(v_label, v_category_name)
  );

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
      v_actor
    );
  end if;
end;
$function$;

revoke all on function public.contribution_event_push_recently(uuid) from public, anon, authenticated;
revoke all on function public.contribution_coordination_recipient_ids(uuid, uuid) from public, anon, authenticated;
revoke all on function public.notify_contribution_coordination(uuid, uuid, text, text) from public, anon, authenticated;
revoke all on function public.notify_contribution_manager_assignment(uuid, uuid, uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.notify_contribution_member_claim(uuid, uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.notify_contribution_release(uuid, uuid, uuid, text) from public, anon, authenticated;
