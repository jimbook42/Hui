-- HUI-027: saved home location on profile, personal setup marker, owner-initiated group deletion.

alter table public.profiles
  add column if not exists home_location_label text,
  add column if not exists home_location_lat double precision,
  add column if not exists home_location_lng double precision,
  add column if not exists personal_setup_completed_at timestamptz;

alter table public.profiles
  drop constraint if exists profiles_home_location_coordinates_check;

alter table public.profiles
  add constraint profiles_home_location_coordinates_check
  check (
    (home_location_lat is null) = (home_location_lng is null)
    and (
      home_location_lat is null
      or (
        home_location_lat between -90 and 90
        and home_location_lng between -180 and 180
      )
    )
  );

comment on column public.profiles.home_location_label is
  'Optional written home address for the member. Used when they host at home.';
comment on column public.profiles.home_location_lat is
  'Optional WGS84 latitude for home. Set together with home_location_lng.';
comment on column public.profiles.home_location_lng is
  'Optional WGS84 longitude for home. Set together with home_location_lat.';
comment on column public.profiles.personal_setup_completed_at is
  'When the member finished or skipped the lightweight personal setup flow.';

create or replace function public.delete_group(p_group_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;

  if not public.is_group_owner(p_group_id) then
    raise exception 'only the owner can delete this group';
  end if;

  perform public._delete_group_cascade(p_group_id);
end;
$function$;

comment on function public.delete_group(uuid) is
  'Owner-only destructive delete of a group and all dependent rows.';

revoke all on function public.delete_group(uuid) from public, anon;
grant execute on function public.delete_group(uuid) to authenticated, service_role;
