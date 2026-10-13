-- HUI-026U.4: optional food involvement for event setup (dietary relevance).
-- Null on existing rows preserves current behaviour (dietary section still shown).

create type public.event_food_involvement as enum ('yes', 'no', 'unsure');

alter table public.events
  add column if not exists food_involvement public.event_food_involvement;

comment on column public.events.food_involvement is
  'Whether food is expected at this gathering. Null = legacy/unknown (treat as relevant for dietary UI).';
