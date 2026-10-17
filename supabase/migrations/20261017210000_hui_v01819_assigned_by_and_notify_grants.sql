-- v0.18.19: self-claim leaves assigned_by null; lock down queue_member_notification EXECUTE.

alter table public.event_contributions
  alter column assigned_by drop not null;

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
      assigned_by = null
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
      null
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

comment on function public.claim_event_contribution(uuid, uuid, text) is
  'Member claims an open contribution slot; organiser assignment uses manager RPCs with assigned_by set.';

create or replace function public.contributions_before_write()
returns trigger
language plpgsql
set search_path = public
as $function$
declare
  v_name text;
begin
  if tg_op = 'UPDATE'
     and coalesce(pg_catalog.current_setting('hui.account_deletion', true), '') = '1'
  then
    return new;
  end if;

  if tg_op = 'UPDATE' then
    new.event_id = old.event_id;
    new.group_id = old.group_id;
    if new.user_id is null then
      -- release / reopen: RPC may clear assignee and assigned_by
    elsif old.user_id is null and new.user_id is not null and new.assigned_by is null then
      -- member self-claim from an open slot
    else
      new.assigned_by = old.assigned_by;
    end if;
    if old.user_id is not null and new.user_id is not null and new.user_id is distinct from old.user_id then
      new.user_id = old.user_id;
    end if;
    if old.household_id is not null and new.household_id is not null
       and new.household_id is distinct from old.household_id then
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

-- Clients must not call queue_member_notification; only SECURITY DEFINER helpers enqueue rows.
revoke all on function public.queue_member_notification(
  uuid,
  public.notification_kind,
  text,
  text,
  uuid,
  uuid,
  text,
  boolean
) from public, anon, authenticated;

grant execute on function public.queue_member_notification(
  uuid,
  public.notification_kind,
  text,
  text,
  uuid,
  uuid,
  text,
  boolean
) to service_role;
