-- HUI-031-B: cycle preference/skip writes only via security definer RPCs (FORCE RLS).

revoke insert on public.group_planning_cycle_skips from authenticated;
drop policy if exists group_planning_cycle_skips_admin_insert on public.group_planning_cycle_skips;

revoke insert, update, delete on public.group_recurrence_preferences from authenticated;
drop policy if exists group_recurrence_preferences_admin_write on public.group_recurrence_preferences;
