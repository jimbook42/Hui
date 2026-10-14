-- HUI-UX1 retest: any active member may fetch the group invite link to share (regenerate stays admin-only).

create or replace function public.get_group_invite_link(p_group_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user uuid := auth.uid();
  v_token text;
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;

  if not exists (
    select 1
    from public.group_memberships m
    where m.group_id = p_group_id
      and m.user_id = v_user
      and m.status = 'active'
  ) then
    raise exception 'not authorised';
  end if;

  select l.token into v_token
  from public.group_invite_links l
  where l.group_id = p_group_id
    and l.revoked_at is null
  limit 1;

  if v_token is not null then
    return v_token;
  end if;

  return public._insert_group_invite_link(p_group_id, v_user);
end;
$function$;

comment on function public.get_group_invite_link(uuid) is
  'Returns the active invite token for a group, creating one when missing. Active members may fetch; regenerate remains admins only.';
