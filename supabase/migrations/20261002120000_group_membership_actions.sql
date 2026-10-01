-- HUI-007: atomic group creation and member self-leave.
-- leave_group runs as definer so members are not granted admin-only membership updates.

create or replace function public.create_group(p_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_user uuid := auth.uid();
  v_group_id uuid;
  v_name text := trim(p_name);
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;

  if char_length(v_name) < 1 or char_length(v_name) > 120 then
    raise exception 'group name must be between 1 and 120 characters';
  end if;

  insert into public.groups (name, owner_id)
  values (v_name, v_user)
  returning id into v_group_id;

  insert into public.group_memberships (group_id, user_id, role, status)
  values (v_group_id, v_user, 'owner', 'active');

  return v_group_id;
end;
$function$;

comment on function public.create_group(text) is
  'Creates a group, owner membership, and default settings in one transaction.';

create or replace function public.leave_group(p_group_id uuid)
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

  if public.is_group_owner(p_group_id) then
    raise exception 'transfer ownership before leaving';
  end if;

  if not public.is_active_member(p_group_id) then
    raise exception 'not an active member';
  end if;

  update public.group_memberships
  set status = 'removed'
  where group_id = p_group_id
    and user_id = v_user
    and status = 'active';

  get diagnostics v_updated = row_count;
  if v_updated <> 1 then
    raise exception 'could not leave group';
  end if;
end;
$function$;

comment on function public.leave_group(uuid) is
  'Active non-owner members leave by marking their membership removed.';

revoke all on function public.create_group(text) from public, anon;
revoke all on function public.leave_group(uuid) from public, anon;
grant execute on function public.create_group(text) to authenticated, service_role;
grant execute on function public.leave_group(uuid) to authenticated, service_role;
