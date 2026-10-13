-- HUI-031-A: mark confirmed events completed (cycle reference advance).

create or replace function public.complete_event(p_event_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_group_id uuid;
  v_created_by uuid;
  v_status public.event_status;
begin
  if v_actor is null then
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
    raise exception 'not a member of this group';
  end if;

  if not (
    public.is_group_admin(v_group_id)
    or v_created_by = v_actor
  ) then
    raise exception 'only the hui creator or a group admin can complete this hui';
  end if;

  if v_status = 'completed' then
    raise exception 'this hui is already completed';
  end if;

  if v_status <> 'confirmed' then
    raise exception 'only confirmed events can be completed';
  end if;

  update public.events
  set
    status = 'completed',
    completed_at = pg_catalog.now(),
    updated_at = pg_catalog.now()
  where id = p_event_id
    and status = 'confirmed';
end;
$function$;

comment on function public.complete_event(uuid) is
  'Marks a confirmed hui as completed. Creator or group admin/owner only. Idempotent rejection if already completed.';

revoke all on function public.complete_event(uuid) from public, anon;
grant execute on function public.complete_event(uuid) to authenticated, service_role;
