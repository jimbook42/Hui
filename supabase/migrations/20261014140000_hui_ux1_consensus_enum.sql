-- HUI-UX1: add majority consensus enum value (must be committed before use in functions/defaults).

alter type public.consensus_rule add value if not exists 'majority_active_members';
