-- HUI-UX1: default consensus rule for newly created groups (apply after v0.15.0 is live).

alter table public.group_settings
  alter column consensus_rule set default 'majority_active_members';
