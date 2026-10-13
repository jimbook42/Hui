-- HUI-026U.3: members are never trapped by an earlier attendance answer.
--
-- Before: once an event was confirmed, `responses_before_write` rejected every response write, so a
-- member who said Yes could not later tell the group they could no longer come.
--
-- Now: attendance on the *confirmed* (selected) time stays editable until the event is completed or
-- cancelled. Consensus is NOT re-run: confirmation is a group decision that already happened; the
-- new answer only updates the attendance roster the group sees.
--
-- Still locked after confirmation (unchanged): adding/withdrawing candidate times, changing the
-- confirmed time, and any response to a non-selected candidate.
--
-- When someone changes to "can't come" their own event-specific commitments that no longer apply are
-- released (their claimed contribution rows). Host-following contributions are left alone: the host
-- has to hand hosting over explicitly via the existing swap flow.

create or replace function public.responses_before_write()
returns trigger
language plpgsql
set search_path = public
as $function$
declare
  v_event_status public.event_status;
  v_candidate_status public.candidate_status;
begin
  if tg_op = 'UPDATE' then
    new.candidate_id = old.candidate_id;
    new.event_id = old.event_id;
    new.group_id = old.group_id;
    new.user_id = old.user_id;
  else
    select c.event_id, c.group_id
    into new.event_id, new.group_id
    from public.event_candidates c
    where c.id = new.candidate_id;

    if new.group_id is null then
      raise exception 'candidate not found';
    end if;
  end if;

  select e.status into v_event_status
  from public.events e
  where e.id = new.event_id;

  if v_event_status is null then
    raise exception 'event not found';
  end if;

  if v_event_status in ('completed', 'cancelled') then
    raise exception 'this event is no longer open for scheduling changes';
  end if;

  if v_event_status = 'confirmed' then
    select c.status into v_candidate_status
    from public.event_candidates c
    where c.id = new.candidate_id;

    if v_candidate_status is distinct from 'selected' then
      raise exception 'this event is no longer open for scheduling changes';
    end if;
  end if;

  if not exists (
    select 1
    from public.group_memberships m
    where m.group_id = new.group_id
      and m.user_id = new.user_id
      and m.status = 'active'
  ) then
    raise exception 'responses require an active group member';
  end if;

  if new.response = 'maybe' and not exists (
    select 1
    from public.group_settings s
    where s.group_id = new.group_id
      and s.maybe_responses_enabled
  ) then
    raise exception 'maybe responses are disabled for this group';
  end if;

  return new;
end;
$function$;

create or replace function public.trg_event_responses_release_on_decline()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  if new.response is distinct from 'no' then
    return new;
  end if;

  if tg_op = 'UPDATE' and old.response is not distinct from 'no' then
    return new;
  end if;

  -- A contribution claimed by someone who now can't come no longer applies to this event.
  -- Rows that follow the accepted host are managed by the host flow and are not touched here.
  delete from public.event_contributions ec
  using public.events e
  where ec.event_id = new.event_id
    and ec.user_id = new.user_id
    and ec.status = 'accepted'
    and e.id = ec.event_id
    and e.status in ('proposing', 'confirmed')
    and not exists (
      select 1
      from public.contribution_categories cc
      where cc.id = ec.category_id
        and cc.follows_host = true
    )
    -- While still scheduling, a "no" to one of several times does not release anything if the
    -- member is still coming (or maybe) on another time. Once confirmed there is only one time.
    and (
      e.status = 'confirmed'
      or not exists (
        select 1
        from public.event_responses r
        join public.event_candidates c on c.id = r.candidate_id
        where r.event_id = new.event_id
          and r.user_id = new.user_id
          and r.candidate_id <> new.candidate_id
          and r.response in ('yes', 'maybe')
          and c.status in ('proposed', 'selected')
      )
    );

  return new;
end;
$function$;

drop trigger if exists event_responses_release_on_decline on public.event_responses;
create trigger event_responses_release_on_decline
  after insert or update of response on public.event_responses
  for each row execute function public.trg_event_responses_release_on_decline();

revoke all on function public.trg_event_responses_release_on_decline() from public, anon;

comment on function public.responses_before_write() is
  'Validates attendance writes. Open while an event is being scheduled and, for the selected time only, after it is confirmed (HUI-026U.3). Locked once completed or cancelled.';
comment on function public.trg_event_responses_release_on_decline() is
  'When a member changes to "can''t come", releases their own claimed contributions (not host-following rows).';
