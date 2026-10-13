-- HUI-031-D: planning cycle cron — notification kind and nudge enqueue.

do $enum$
begin
  alter type public.notification_kind add value 'planning_cycle_opens';
exception
  when duplicate_object then null;
end
$enum$;

create or replace function public.refresh_all_group_planning_snapshots()
returns integer
language sql
security definer
set search_path = ''
as $$
  select count(*)::integer
  from public.group_settings gs
  where gs.recurring_events_enabled
    and gs.recurrence_interval_unit is not null
    and gs.recurrence_anchor_date is not null;
$$;

comment on function public.refresh_all_group_planning_snapshots() is
  'Returns recurring groups eligible for snapshot refresh. The Vercel cron worker recomputes snapshots in app code.';

create or replace function public.enqueue_planning_cycle_nudges(
  p_as_of date default current_date
)
returns integer
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_row record;
  v_member record;
  v_queued integer := 0;
  v_title text := 'Time to plan the next hui';
  v_body text;
  v_dedupe text;
  v_notification_id uuid;
begin
  for v_row in
    select
      s.group_id,
      s.next_nominal_date,
      s.planning_opens_on,
      g.name as group_name,
      gs.who_may_propose
    from public.group_planning_cycle_snapshots s
    inner join public.group_settings gs on gs.group_id = s.group_id
    inner join public.groups g on g.id = s.group_id
    left join public.group_recurrence_preferences pref on pref.group_id = s.group_id
    where s.phase = 'ready_to_plan'
      and s.next_nominal_date is not null
      and s.planning_opens_on is not null
      and s.planning_opens_on <= p_as_of
      and pref.recurrence_paused_at is null
      and not exists (
        select 1
        from public.events e
        where e.group_id = s.group_id
          and e.status in ('proposing', 'confirmed')
          and e.planning_target_date = s.next_nominal_date
      )
  loop
    v_dedupe := 'planning_cycle_opens:' || v_row.group_id::text || ':' || v_row.next_nominal_date::text;
    v_body := 'Planning is open for ' || v_row.group_name || ' around ' || to_char(v_row.next_nominal_date, 'DD Mon YYYY') || '.';

    for v_member in
      select m.user_id, m.role
      from public.group_memberships m
      where m.group_id = v_row.group_id
        and m.status = 'active'
        and (
          v_row.who_may_propose = 'any_member'
          or m.role in ('owner', 'admin')
        )
    loop
      v_notification_id := public.queue_member_notification(
        v_member.user_id,
        'planning_cycle_opens'::public.notification_kind,
        v_title,
        v_body,
        v_row.group_id,
        null,
        v_dedupe,
        false
      );
      if v_notification_id is not null then
        v_queued := v_queued + 1;
      end if;
    end loop;
  end loop;

  return v_queued;
end;
$function$;

comment on function public.enqueue_planning_cycle_nudges(date) is
  'Idempotent in-app nudges when a recurring group planning window is open (not when paused).';

revoke all on function public.enqueue_planning_cycle_nudges(date) from public, anon, authenticated;
grant execute on function public.enqueue_planning_cycle_nudges(date) to service_role;
