-- HUI-031-C: admin cadence/anchor edit (mirrors group_settings + canonical series).

create or replace function public.update_group_recurrence_cadence(
  p_group_id uuid,
  p_interval_unit public.cadence_unit,
  p_interval_count integer,
  p_anchor_date date
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_series_id uuid;
  v_recurring boolean;
begin
  if v_actor is null then
    raise exception 'not authenticated';
  end if;

  if not public.is_group_admin(p_group_id) then
    raise exception 'only a group admin can edit recurrence';
  end if;

  if p_interval_count is null or p_interval_count < 1 or p_interval_count > 52 then
    raise exception 'interval must be between 1 and 52';
  end if;

  if p_anchor_date is null then
    raise exception 'enter a valid anchor date';
  end if;

  if p_interval_unit not in ('week', 'month') then
    raise exception 'invalid cadence unit';
  end if;

  select gs.recurring_events_enabled, gs.canonical_recurrence_series_id
  into v_recurring, v_series_id
  from public.group_settings gs
  where gs.group_id = p_group_id;

  if not coalesce(v_recurring, false) then
    raise exception 'recurring events are not enabled for this group';
  end if;

  update public.group_settings
  set
    recurrence_interval_unit = p_interval_unit,
    recurrence_interval_count = p_interval_count,
    recurrence_anchor_date = p_anchor_date
  where group_id = p_group_id;

  if v_series_id is not null then
    update public.recurrence_series
    set
      interval_unit = p_interval_unit,
      interval_count = p_interval_count,
      starts_on = p_anchor_date,
      updated_at = pg_catalog.now()
    where id = v_series_id
      and group_id = p_group_id
      and archived_at is null;
  end if;
end;
$function$;

revoke all on function public.update_group_recurrence_cadence(uuid, public.cadence_unit, integer, date) from public, anon;
grant execute on function public.update_group_recurrence_cadence(uuid, public.cadence_unit, integer, date) to authenticated, service_role;
