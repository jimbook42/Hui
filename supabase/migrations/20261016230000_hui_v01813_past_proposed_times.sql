-- Reject proposed times that have already started (INSERT only; existing past rows unchanged).
-- Covers propose_group_event and direct inserts into event_candidates.

create or replace function public.reject_past_event_candidate_start()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if coalesce(current_setting('hui.allow_past_event_candidates', true), 'off') = 'on' then
    return new;
  end if;
  if new.starts_at is not null and new.starts_at <= pg_catalog.now() then
    raise exception 'that time has already passed';
  end if;
  return new;
end;
$function$;

drop trigger if exists event_candidates_reject_past_start on public.event_candidates;

create trigger event_candidates_reject_past_start
  before insert on public.event_candidates
  for each row
  execute function public.reject_past_event_candidate_start();
