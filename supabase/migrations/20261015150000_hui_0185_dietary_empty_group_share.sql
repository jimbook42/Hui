-- HUI-0185: allow sharing "no dietary requirements" with a group without creating entries.
-- Additive only; existing entry-based sharing unchanged.

create table public.dietary_empty_group_shares (
  user_id uuid not null references auth.users (id) on delete cascade,
  group_id uuid not null references public.groups (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, group_id)
);

comment on table public.dietary_empty_group_shares is
  'Owner opt-in: active group members see that this member has no dietary requirements to share.';

create index dietary_empty_group_shares_group_idx
  on public.dietary_empty_group_shares (group_id);

alter table public.dietary_empty_group_shares enable row level security;
alter table public.dietary_empty_group_shares force row level security;

create policy dietary_empty_group_shares_select
  on public.dietary_empty_group_shares
  for select
  to authenticated
  using (
    public.is_active_member(group_id)
    and (
      user_id = auth.uid()
      or exists (
        select 1
        from public.group_memberships m
        where m.user_id = dietary_empty_group_shares.user_id
          and m.group_id = dietary_empty_group_shares.group_id
          and m.status = 'active'
      )
    )
  );

create policy dietary_empty_group_shares_insert
  on public.dietary_empty_group_shares
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and public.is_active_member(group_id)
  );

create policy dietary_empty_group_shares_delete
  on public.dietary_empty_group_shares
  for delete
  to authenticated
  using (user_id = auth.uid());

revoke all on table public.dietary_empty_group_shares from public, anon, authenticated;
grant select, insert, delete on public.dietary_empty_group_shares to authenticated;
grant all on table public.dietary_empty_group_shares to service_role;

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
  union all
  select
    e.user_id,
    e.user_id,
    p.display_name,
    'requirement'::public.dietary_category,
    'No dietary requirements',
    null::text,
    'empty' as scope
  from public.dietary_empty_group_shares e
  join public.group_memberships m
    on m.user_id = e.user_id
   and m.group_id = p_group_id
   and m.status = 'active'
  join public.profiles p
    on p.id = e.user_id
  where e.group_id = p_group_id
    and public.is_active_member(p_group_id)
    and not exists (
      select 1
      from public.dietary_entries d
      where d.user_id = e.user_id
        and (
          d.share_with_all_groups
          or exists (
            select 1
            from public.dietary_entry_shares s
            where s.dietary_entry_id = d.id
              and s.group_id = p_group_id
          )
        )
    )
  order by display_name, label;
$function$;

comment on function public.list_group_dietary(uuid) is
  'Dietary entries visible to the caller for one group, plus explicit empty-profile shares (scope empty).';
