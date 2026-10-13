-- HUI-031-B: force RLS on cycle engine tables.

alter table public.group_recurrence_preferences force row level security;
alter table public.group_planning_cycle_skips force row level security;
alter table public.group_planning_cycle_snapshots force row level security;
