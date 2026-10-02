-- HUI-018: member contribution claim, update, and release on events.

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
  v_label text;
  v_contribution_id uuid;
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

  select c.name
  into v_category_name
  from public.contribution_categories c
  where c.id = p_category_id
    and c.group_id = v_group_id
    and c.archived_at is null;

  if v_category_name is null then
    raise exception 'contribution category not found or inactive';
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

create or replace function public.update_my_event_contribution(
  p_contribution_id uuid,
  p_description text
)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_user uuid := auth.uid();
  v_label text;
  v_updated integer;
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;

  v_label := nullif(trim(coalesce(p_description, '')), '');
  if v_label is null then
    raise exception 'description is required';
  end if;

  if char_length(v_label) < 1 or char_length(v_label) > 160 then
    raise exception 'description must be between 1 and 160 characters';
  end if;

  update public.event_contributions ec
  set label = v_label
  from public.events e
  where ec.id = p_contribution_id
    and ec.event_id = e.id
    and ec.user_id = v_user
    and ec.status = 'accepted'
    and e.status not in ('cancelled', 'completed');

  get diagnostics v_updated = row_count;
  if v_updated <> 1 then
    raise exception 'contribution not found or cannot be updated';
  end if;
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
  v_deleted integer;
begin
  if v_user is null then
    raise exception 'not authenticated';
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
end;
$function$;

comment on function public.claim_event_contribution(uuid, uuid, text) is
  'Active group member claims an open contribution category on a non-terminal event.';
comment on function public.update_my_event_contribution(uuid, text) is
  'Contribution owner updates their accepted contribution label.';
comment on function public.release_event_contribution(uuid) is
  'Contribution owner removes their accepted claim for the current event.';

revoke all on function public.claim_event_contribution(uuid, uuid, text) from public, anon;
revoke all on function public.update_my_event_contribution(uuid, text) from public, anon;
revoke all on function public.release_event_contribution(uuid) from public, anon;

grant execute on function public.claim_event_contribution(uuid, uuid, text) to authenticated, service_role;
grant execute on function public.update_my_event_contribution(uuid, text) to authenticated, service_role;
grant execute on function public.release_event_contribution(uuid) to authenticated, service_role;
