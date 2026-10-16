-- v0.18.15: fix hui/group delete when event decisions are decided (RESTRICT FK on selected_option_id).

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
  delete from public.event_decision_responses
  where decision_id in (select ed.id from public.event_decisions ed where ed.event_id = p_event_id);
  delete from public.event_decisions where event_id = p_event_id;
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

create or replace function public._delete_group_cascade(p_group_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $function$
begin
  delete from public.event_memory_attendees
  where memory_id in (
    select em.id from public.event_memories em where em.group_id = p_group_id
  );

  delete from public.event_memories where group_id = p_group_id;
  delete from public.event_decision_responses
  where decision_id in (
    select ed.id
    from public.event_decisions ed
    inner join public.events e on e.id = ed.event_id
    where e.group_id = p_group_id
  );
  delete from public.event_decisions ed
  using public.events e
  where ed.event_id = e.id
    and e.group_id = p_group_id;
  delete from public.event_responses where group_id = p_group_id;
  delete from public.event_contributions where group_id = p_group_id;
  delete from public.host_assignments where group_id = p_group_id;
  delete from public.event_candidates where group_id = p_group_id;
  delete from public.events where group_id = p_group_id;
  delete from public.group_settings where group_id = p_group_id;
  delete from public.recurrence_series where group_id = p_group_id;
  delete from public.contribution_categories where group_id = p_group_id;
  delete from public.dietary_entry_shares where group_id = p_group_id;
  delete from public.household_members where group_id = p_group_id;
  delete from public.households where group_id = p_group_id;
  delete from public.membership_changes where group_id = p_group_id;
  delete from public.group_memberships where group_id = p_group_id;
  delete from public.groups where id = p_group_id;
end;
$function$;

comment on function public._delete_group_cascade(uuid) is
  'Internal: removes one group and all dependent rows. Not callable by clients.';

revoke all on function public._delete_group_cascade(uuid) from public, anon, authenticated;
