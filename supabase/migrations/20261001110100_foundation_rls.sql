-- Tenancy policies for the foundation schema.
-- Membership checks use security definer helpers so a policy on group_memberships
-- does not recursively evaluate itself. Each helper returns a boolean for auth.uid()
-- and sets search_path so it cannot be redirected at runtime.
-- Event status transitions, vetoes, and consensus are not enforced here.

create or replace function public.is_active_member(p_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $function$
  select exists (
    select 1
    from public.group_memberships m
    where m.group_id = p_group_id
      and m.user_id = auth.uid()
      and m.status = 'active'
  );
$function$;

create or replace function public.is_group_admin(p_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $function$
  select exists (
    select 1
    from public.group_memberships m
    where m.group_id = p_group_id
      and m.user_id = auth.uid()
      and m.status = 'active'
      and m.role in ('owner', 'admin')
  );
$function$;

create or replace function public.is_group_owner(p_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $function$
  select exists (
    select 1
    from public.group_memberships m
    where m.group_id = p_group_id
      and m.user_id = auth.uid()
      and m.status = 'active'
      and m.role = 'owner'
  );
$function$;

create or replace function public.can_propose_in_group(p_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $function$
  select
    public.is_group_admin(p_group_id)
    or (
      public.is_active_member(p_group_id)
      and exists (
        select 1
        from public.group_settings s
        where s.group_id = p_group_id
          and s.who_may_propose = 'any_member'
      )
    );
$function$;

create or replace function public.group_allows_event(p_group_id uuid, p_series_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $function$
  select exists (
    select 1
    from public.group_settings s
    where s.group_id = p_group_id
      and (
        (p_series_id is null and s.one_off_events_allowed)
        or (p_series_id is not null and s.recurring_events_enabled)
      )
  );
$function$;

create or replace function public.can_read_dietary_entry(p_entry_id uuid, p_owner_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $function$
  select p_owner_id = auth.uid()
    or exists (
      select 1
      from public.dietary_entry_shares sh
      join public.group_memberships owner_m
        on owner_m.group_id = sh.group_id
       and owner_m.user_id = p_owner_id
       and owner_m.status = 'active'
      where sh.dietary_entry_id = p_entry_id
        and public.is_active_member(sh.group_id)
    );
$function$;

create or replace function public.can_read_dietary_share(p_entry_id uuid, p_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $function$
  select public.is_active_member(p_group_id)
    and exists (
      select 1
      from public.dietary_entries d
      join public.group_memberships owner_m
        on owner_m.user_id = d.user_id
       and owner_m.group_id = p_group_id
       and owner_m.status = 'active'
      where d.id = p_entry_id
    );
$function$;

create or replace function public.owns_dietary_entry(p_entry_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $function$
  select exists (
    select 1
    from public.dietary_entries d
    where d.id = p_entry_id
      and d.user_id = auth.uid()
  );
$function$;

create or replace function public.transfer_group_ownership(
  p_group_id uuid,
  p_new_owner uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_actor uuid := auth.uid();
  v_updated integer;
begin
  -- SECURITY DEFINER: one statement must change both membership rows, and
  -- groups.owner_id is not client-writable. The caller's auth.uid() is checked
  -- below; a missing user cannot transfer.
  if v_actor is null then
    raise exception 'not authenticated';
  end if;

  if not public.is_group_owner(p_group_id) then
    raise exception 'only the owner can transfer ownership';
  end if;

  if p_new_owner is not distinct from v_actor then
    raise exception 'new owner must be a different member';
  end if;

  if not exists (
    select 1
    from public.group_memberships m
    where m.group_id = p_group_id
      and m.user_id = p_new_owner
      and m.status = 'active'
  ) then
    raise exception 'new owner must be an active member';
  end if;

  -- Demote before promoting. One statement that swaps both rows can trip the
  -- single-owner index when the new owner is written first.
  perform 1
  from public.group_memberships
  where group_id = p_group_id
    and user_id in (v_actor, p_new_owner)
  for update;

  update public.group_memberships
  set role = 'admin'
  where group_id = p_group_id
    and user_id = v_actor
    and role = 'owner';

  get diagnostics v_updated = row_count;
  if v_updated <> 1 then
    raise exception 'ownership transfer could not demote the current owner';
  end if;

  update public.group_memberships
  set role = 'owner'
  where group_id = p_group_id
    and user_id = p_new_owner
    and status = 'active';

  get diagnostics v_updated = row_count;
  if v_updated <> 1 then
    raise exception 'ownership transfer could not promote the new owner';
  end if;
end;
$function$;

comment on function public.is_active_member(uuid) is
  'Security definer membership test for auth.uid(). Avoids RLS recursion on group_memberships.';
comment on function public.transfer_group_ownership(uuid, uuid) is
  'Owner-only ownership transfer. Runs as the table owner so owner_id can change.';

create policy profiles_select
  on public.profiles
  for select
  to authenticated
  using (
    id = (select auth.uid())
    or exists (
      select 1
      from public.group_memberships mine
      join public.group_memberships theirs
        on theirs.group_id = mine.group_id
       and theirs.status = 'active'
      where mine.user_id = (select auth.uid())
        and mine.status = 'active'
        and theirs.user_id = profiles.id
    )
  );

create policy profiles_insert
  on public.profiles
  for insert
  to authenticated
  with check (id = (select auth.uid()));

create policy profiles_update
  on public.profiles
  for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy groups_select
  on public.groups
  for select
  to authenticated
  using (
    public.is_active_member(id)
    or owner_id = (select auth.uid())
  );

create policy groups_insert
  on public.groups
  for insert
  to authenticated
  with check (owner_id = (select auth.uid()));

create policy groups_update
  on public.groups
  for update
  to authenticated
  using (public.is_group_admin(id))
  with check (public.is_group_admin(id));

create policy group_settings_select
  on public.group_settings
  for select
  to authenticated
  using (public.is_active_member(group_id));

create policy group_settings_update
  on public.group_settings
  for update
  to authenticated
  using (public.is_group_admin(group_id))
  with check (public.is_group_admin(group_id));

create policy group_memberships_select
  on public.group_memberships
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or public.is_active_member(group_id)
  );

create policy group_memberships_insert
  on public.group_memberships
  for insert
  to authenticated
  with check (
    (
      user_id = (select auth.uid())
      and role = 'owner'
      and status = 'active'
      and exists (
        select 1
        from public.groups g
        where g.id = group_id
          and g.owner_id = (select auth.uid())
      )
    )
    or public.is_group_admin(group_id)
  );

create policy group_memberships_update
  on public.group_memberships
  for update
  to authenticated
  using (public.is_group_admin(group_id))
  with check (public.is_group_admin(group_id));

create policy membership_changes_select
  on public.membership_changes
  for select
  to authenticated
  using (public.is_group_admin(group_id));

create policy households_select
  on public.households
  for select
  to authenticated
  using (public.is_active_member(group_id));

create policy households_insert
  on public.households
  for insert
  to authenticated
  with check (public.is_group_admin(group_id));

create policy households_update
  on public.households
  for update
  to authenticated
  using (public.is_group_admin(group_id))
  with check (public.is_group_admin(group_id));

create policy households_delete
  on public.households
  for delete
  to authenticated
  using (public.is_group_admin(group_id));

create policy household_members_select
  on public.household_members
  for select
  to authenticated
  using (public.is_active_member(group_id));

create policy household_members_insert
  on public.household_members
  for insert
  to authenticated
  with check (public.is_group_admin(group_id));

create policy household_members_delete
  on public.household_members
  for delete
  to authenticated
  using (public.is_group_admin(group_id));

create policy recurrence_series_select
  on public.recurrence_series
  for select
  to authenticated
  using (public.is_active_member(group_id));

create policy recurrence_series_insert
  on public.recurrence_series
  for insert
  to authenticated
  with check (
    created_by = (select auth.uid())
    and public.can_propose_in_group(group_id)
    and exists (
      select 1
      from public.group_settings s
      where s.group_id = recurrence_series.group_id
        and s.recurring_events_enabled
    )
  );

create policy recurrence_series_update
  on public.recurrence_series
  for update
  to authenticated
  using (public.is_group_admin(group_id))
  with check (public.is_group_admin(group_id));

create policy events_select
  on public.events
  for select
  to authenticated
  using (public.is_active_member(group_id));

create policy events_insert
  on public.events
  for insert
  to authenticated
  with check (
    created_by = (select auth.uid())
    and public.can_propose_in_group(group_id)
    and public.group_allows_event(group_id, recurrence_series_id)
  );

create policy events_update
  on public.events
  for update
  to authenticated
  using (public.is_active_member(group_id))
  with check (public.is_active_member(group_id));

create policy event_candidates_select
  on public.event_candidates
  for select
  to authenticated
  using (public.is_active_member(group_id));

create policy event_candidates_insert
  on public.event_candidates
  for insert
  to authenticated
  with check (
    proposed_by = (select auth.uid())
    and public.can_propose_in_group(group_id)
  );

create policy event_candidates_update
  on public.event_candidates
  for update
  to authenticated
  using (public.is_active_member(group_id))
  with check (public.is_active_member(group_id));

create policy event_responses_select
  on public.event_responses
  for select
  to authenticated
  using (
    public.is_active_member(group_id)
    and (
      user_id = (select auth.uid())
      or visibility = 'group'
    )
  );

create policy event_responses_insert
  on public.event_responses
  for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and public.is_active_member(group_id)
  );

create policy event_responses_update
  on public.event_responses
  for update
  to authenticated
  using (
    user_id = (select auth.uid())
    and public.is_active_member(group_id)
  )
  with check (
    user_id = (select auth.uid())
    and public.is_active_member(group_id)
  );

create policy host_assignments_select
  on public.host_assignments
  for select
  to authenticated
  using (public.is_active_member(group_id));

create policy host_assignments_insert
  on public.host_assignments
  for insert
  to authenticated
  with check (
    assigned_by = (select auth.uid())
    and public.is_active_member(group_id)
  );

create policy host_assignments_update
  on public.host_assignments
  for update
  to authenticated
  using (
    public.is_group_admin(group_id)
    or user_id = (select auth.uid())
    or exists (
      select 1
      from public.household_members hm
      where hm.household_id = host_assignments.household_id
        and hm.user_id = (select auth.uid())
    )
  )
  with check (
    public.is_group_admin(group_id)
    or user_id = (select auth.uid())
    or exists (
      select 1
      from public.household_members hm
      where hm.household_id = host_assignments.household_id
        and hm.user_id = (select auth.uid())
    )
  );

create policy contribution_categories_select
  on public.contribution_categories
  for select
  to authenticated
  using (public.is_active_member(group_id));

create policy contribution_categories_insert
  on public.contribution_categories
  for insert
  to authenticated
  with check (public.is_group_admin(group_id));

create policy contribution_categories_update
  on public.contribution_categories
  for update
  to authenticated
  using (public.is_group_admin(group_id))
  with check (public.is_group_admin(group_id));

create policy event_contributions_select
  on public.event_contributions
  for select
  to authenticated
  using (public.is_active_member(group_id));

create policy event_contributions_insert
  on public.event_contributions
  for insert
  to authenticated
  with check (
    assigned_by = (select auth.uid())
    and public.is_active_member(group_id)
  );

create policy event_contributions_update
  on public.event_contributions
  for update
  to authenticated
  using (
    public.is_group_admin(group_id)
    or user_id = (select auth.uid())
    or user_id is null
    or exists (
      select 1
      from public.household_members hm
      where hm.household_id = event_contributions.household_id
        and hm.user_id = (select auth.uid())
    )
  )
  with check (
    public.is_group_admin(group_id)
    or user_id = (select auth.uid())
    or user_id is null
    or exists (
      select 1
      from public.household_members hm
      where hm.household_id = event_contributions.household_id
        and hm.user_id = (select auth.uid())
    )
  );

create policy dietary_entries_select
  on public.dietary_entries
  for select
  to authenticated
  using (public.can_read_dietary_entry(id, user_id));

create policy dietary_entries_insert
  on public.dietary_entries
  for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create policy dietary_entries_update
  on public.dietary_entries
  for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy dietary_entries_delete
  on public.dietary_entries
  for delete
  to authenticated
  using (user_id = (select auth.uid()));

create policy dietary_entry_shares_select
  on public.dietary_entry_shares
  for select
  to authenticated
  using (public.can_read_dietary_share(dietary_entry_id, group_id));

create policy dietary_entry_shares_insert
  on public.dietary_entry_shares
  for insert
  to authenticated
  with check (
    public.owns_dietary_entry(dietary_entry_id)
    and public.is_active_member(group_id)
  );

create policy dietary_entry_shares_delete
  on public.dietary_entry_shares
  for delete
  to authenticated
  using (public.owns_dietary_entry(dietary_entry_id));

create policy event_memories_select
  on public.event_memories
  for select
  to authenticated
  using (public.is_active_member(group_id));

create policy event_memories_insert
  on public.event_memories
  for insert
  to authenticated
  with check (
    recorded_by = (select auth.uid())
    and public.is_active_member(group_id)
  );

create policy event_memories_update
  on public.event_memories
  for update
  to authenticated
  using (public.is_active_member(group_id))
  with check (public.is_active_member(group_id));

create policy event_memory_attendees_select
  on public.event_memory_attendees
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.event_memories mem
      where mem.id = memory_id
        and public.is_active_member(mem.group_id)
    )
  );

create policy event_memory_attendees_insert
  on public.event_memory_attendees
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.event_memories mem
      where mem.id = memory_id
        and public.is_active_member(mem.group_id)
    )
  );

revoke all on table public.profiles from public, anon, authenticated;
revoke all on table public.groups from public, anon, authenticated;
revoke all on table public.group_settings from public, anon, authenticated;
revoke all on table public.group_memberships from public, anon, authenticated;
revoke all on table public.membership_changes from public, anon, authenticated;
revoke all on table public.households from public, anon, authenticated;
revoke all on table public.household_members from public, anon, authenticated;
revoke all on table public.recurrence_series from public, anon, authenticated;
revoke all on table public.events from public, anon, authenticated;
revoke all on table public.event_candidates from public, anon, authenticated;
revoke all on table public.event_responses from public, anon, authenticated;
revoke all on table public.host_assignments from public, anon, authenticated;
revoke all on table public.contribution_categories from public, anon, authenticated;
revoke all on table public.event_contributions from public, anon, authenticated;
revoke all on table public.dietary_entries from public, anon, authenticated;
revoke all on table public.dietary_entry_shares from public, anon, authenticated;
revoke all on table public.event_memories from public, anon, authenticated;
revoke all on table public.event_memory_attendees from public, anon, authenticated;

grant select, insert, update on public.profiles to authenticated;
grant select, insert, update on public.groups to authenticated;
grant select, update on public.group_settings to authenticated;
grant select, insert, update on public.group_memberships to authenticated;
grant select on public.membership_changes to authenticated;
grant select, insert, update, delete on public.households to authenticated;
grant select, insert, delete on public.household_members to authenticated;
grant select, insert, update on public.recurrence_series to authenticated;
grant select, insert, update on public.events to authenticated;
grant select, insert, update on public.event_candidates to authenticated;
grant select, insert, update on public.event_responses to authenticated;
grant select, insert, update on public.host_assignments to authenticated;
grant select, insert, update on public.contribution_categories to authenticated;
grant select, insert, update on public.event_contributions to authenticated;
grant select, insert, update, delete on public.dietary_entries to authenticated;
grant select, insert, delete on public.dietary_entry_shares to authenticated;
grant select, insert, update on public.event_memories to authenticated;
grant select, insert on public.event_memory_attendees to authenticated;

grant all on table public.profiles to service_role;
grant all on table public.groups to service_role;
grant all on table public.group_settings to service_role;
grant all on table public.group_memberships to service_role;
grant all on table public.membership_changes to service_role;
grant all on table public.households to service_role;
grant all on table public.household_members to service_role;
grant all on table public.recurrence_series to service_role;
grant all on table public.events to service_role;
grant all on table public.event_candidates to service_role;
grant all on table public.event_responses to service_role;
grant all on table public.host_assignments to service_role;
grant all on table public.contribution_categories to service_role;
grant all on table public.event_contributions to service_role;
grant all on table public.dietary_entries to service_role;
grant all on table public.dietary_entry_shares to service_role;
grant all on table public.event_memories to service_role;
grant all on table public.event_memory_attendees to service_role;

revoke all on function public.set_updated_at() from public, anon;
revoke all on function public.running_as_table_owner(regclass) from public, anon;
revoke all on function public.handle_new_user() from public, anon;
revoke all on function public.create_default_group_settings() from public, anon;
revoke all on function public.groups_before_write() from public, anon;
revoke all on function public.memberships_before_write() from public, anon;
revoke all on function public.memberships_after_write() from public, anon;
revoke all on function public.events_before_write() from public, anon;
revoke all on function public.candidates_before_write() from public, anon;
revoke all on function public.responses_before_write() from public, anon;
revoke all on function public.hosts_before_write() from public, anon;
revoke all on function public.contributions_before_write() from public, anon;
revoke all on function public.household_members_before_write() from public, anon;
revoke all on function public.memories_before_write() from public, anon;
revoke all on function public.memory_attendees_before_write() from public, anon;
revoke all on function public.is_active_member(uuid) from public, anon;
revoke all on function public.is_group_admin(uuid) from public, anon;
revoke all on function public.is_group_owner(uuid) from public, anon;
revoke all on function public.can_propose_in_group(uuid) from public, anon;
revoke all on function public.group_allows_event(uuid, uuid) from public, anon;
revoke all on function public.can_read_dietary_entry(uuid, uuid) from public, anon;
revoke all on function public.can_read_dietary_share(uuid, uuid) from public, anon;
revoke all on function public.owns_dietary_entry(uuid) from public, anon;
revoke all on function public.transfer_group_ownership(uuid, uuid) from public, anon;

grant execute on function public.set_updated_at() to authenticated, service_role;
grant execute on function public.running_as_table_owner(regclass) to authenticated, service_role;
grant execute on function public.handle_new_user() to authenticated, service_role;
grant execute on function public.create_default_group_settings() to authenticated, service_role;
grant execute on function public.groups_before_write() to authenticated, service_role;
grant execute on function public.memberships_before_write() to authenticated, service_role;
grant execute on function public.memberships_after_write() to authenticated, service_role;
grant execute on function public.events_before_write() to authenticated, service_role;
grant execute on function public.candidates_before_write() to authenticated, service_role;
grant execute on function public.responses_before_write() to authenticated, service_role;
grant execute on function public.hosts_before_write() to authenticated, service_role;
grant execute on function public.contributions_before_write() to authenticated, service_role;
grant execute on function public.household_members_before_write() to authenticated, service_role;
grant execute on function public.memories_before_write() to authenticated, service_role;
grant execute on function public.memory_attendees_before_write() to authenticated, service_role;
grant execute on function public.is_active_member(uuid) to authenticated, service_role;
grant execute on function public.is_group_admin(uuid) to authenticated, service_role;
grant execute on function public.is_group_owner(uuid) to authenticated, service_role;
grant execute on function public.can_propose_in_group(uuid) to authenticated, service_role;
grant execute on function public.group_allows_event(uuid, uuid) to authenticated, service_role;
grant execute on function public.can_read_dietary_entry(uuid, uuid) to authenticated, service_role;
grant execute on function public.can_read_dietary_share(uuid, uuid) to authenticated, service_role;
grant execute on function public.owns_dietary_entry(uuid) to authenticated, service_role;
grant execute on function public.transfer_group_ownership(uuid, uuid) to authenticated, service_role;
