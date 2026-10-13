-- HUI-026D: secure single-event deletion (creator or group admin/owner).

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
  delete from public.event_responses where event_id = p_event_id;
  delete from public.event_contributions where event_id = p_event_id;
  delete from public.host_assignments where event_id = p_event_id;
  delete from public.event_candidates where event_id = p_event_id;
  delete from public.events where id = p_event_id;
end;
$function$;

comment on function public._delete_event_cascade(uuid) is
  'Internal: removes one event and dependent planning rows. Not callable by clients.';

revoke all on function public._delete_event_cascade(uuid) from public, anon, authenticated;

create or replace function public.delete_event(p_event_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_user uuid := auth.uid();
  v_group_id uuid;
  v_created_by uuid;
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;

  select e.group_id, e.created_by
  into v_group_id, v_created_by
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
    or v_created_by = v_user
  ) then
    raise exception 'only the hui creator or a group admin can delete this hui';
  end if;

  perform public._delete_event_cascade(p_event_id);
end;
$function$;

comment on function public.delete_event(uuid) is
  'Destructive delete of one hui and its planning data. Creator or group admin/owner only.';

revoke all on function public.delete_event(uuid) from public, anon;
grant execute on function public.delete_event(uuid) to authenticated, service_role;

drop policy if exists events_delete on public.events;
create policy events_delete
  on public.events
  for delete
  to authenticated
  using (
    public.is_active_member(group_id)
    and (
      public.is_group_admin(group_id)
      or created_by = (select auth.uid())
    )
  );

grant delete on public.events to authenticated;
