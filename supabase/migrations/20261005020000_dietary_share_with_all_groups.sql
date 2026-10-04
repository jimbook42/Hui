-- HUI-026U.3: explicit "share with all my groups" scope for dietary entries.
--
-- Model (additive, privacy-safe by default):
--   * `dietary_entry_shares` (group-specific sharing) is unchanged and keeps its meaning.
--   * `dietary_entries.share_with_all_groups` is a new per-entry flag, default false. Nothing existing
--     is migrated into it. The owner must turn it on explicitly, and can turn it off again.
--   * When the flag is on, the entry is readable by active members of any group where the owner is
--     also an active member (including groups joined later: that is what "all my groups" means).
--   * When the flag is off, only the group-specific shares apply, exactly as before. Existing
--     group-specific share rows are never deleted or rewritten by toggling the flag.
--
-- Authorisation is enforced here (RLS helper functions + the listing function), not in the client.

alter table public.dietary_entries
  add column if not exists share_with_all_groups boolean not null default false;

comment on column public.dietary_entries.share_with_all_groups is
  'Owner opt-in: entry is visible to active members of every group the owner is an active member of. Default false (private / group-specific only).';

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
    )
    or (
      exists (
        select 1
        from public.dietary_entries d
        where d.id = p_entry_id
          and d.user_id = p_owner_id
          and d.share_with_all_groups
      )
      and exists (
        select 1
        from public.group_memberships owner_m
        join public.group_memberships viewer_m
          on viewer_m.group_id = owner_m.group_id
         and viewer_m.user_id = auth.uid()
         and viewer_m.status = 'active'
        where owner_m.user_id = p_owner_id
          and owner_m.status = 'active'
      )
    );
$function$;

-- Group listing used by the group and event pages. SECURITY INVOKER on purpose: the rows a caller
-- sees are decided by the dietary_entries RLS policy (can_read_dietary_entry), so there is a single
-- source of truth for who can read what.
create or replace function public.list_group_dietary(p_group_id uuid)
returns table (
  entry_id uuid,
  user_id uuid,
  display_name text,
  category public.dietary_category,
  label text,
  notes text,
  scope text
)
language sql
stable
security invoker
set search_path = public
as $function$
  select
    d.id,
    d.user_id,
    p.display_name,
    d.category,
    d.label,
    d.notes,
    case
      when exists (
        select 1
        from public.dietary_entry_shares s
        where s.dietary_entry_id = d.id
          and s.group_id = p_group_id
      ) then 'group'
      else 'all_groups'
    end as scope
  from public.dietary_entries d
  join public.group_memberships m
    on m.user_id = d.user_id
   and m.group_id = p_group_id
   and m.status = 'active'
  join public.profiles p
    on p.id = d.user_id
  where public.is_active_member(p_group_id)
    and (
      d.share_with_all_groups
      or exists (
        select 1
        from public.dietary_entry_shares s
        where s.dietary_entry_id = d.id
          and s.group_id = p_group_id
      )
    )
  order by p.display_name, d.label;
$function$;

revoke all on function public.list_group_dietary(uuid) from public, anon;
grant execute on function public.list_group_dietary(uuid) to authenticated, service_role;

comment on function public.list_group_dietary(uuid) is
  'Dietary entries visible to the caller for one group: group-specific shares plus owners'' all-groups entries. Scope is "group" when explicitly shared with this group, otherwise "all_groups".';
