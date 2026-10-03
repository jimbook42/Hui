-- HUI-022A.3: ensure host-bound contributions exist and follow the accepted host
-- while the event is still proposing (not only after finalise_event seeds rows).

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
  v_status public.event_status;
begin
  select e.group_id, e.status
  into v_group_id, v_status
  from public.events e
  where e.id = p_event_id;

  if v_group_id is null then
    return;
  end if;

  if v_status not in ('proposing', 'confirmed') then
    return;
  end if;

  perform public.seed_event_contributions(p_event_id, auth.uid());

  select ha.user_id, ha.display_name
  into v_host_user, v_display_name
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

comment on function public.sync_host_bound_contributions(uuid) is
  'Keeps host-following event contributions aligned with the accepted host. Seeds missing rows during proposing or confirmed coordination.';
