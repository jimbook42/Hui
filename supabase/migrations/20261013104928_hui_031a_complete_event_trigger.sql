-- HUI-031-A: allow complete_event to transition confirmed -> completed.

create or replace function public.events_before_write()
returns trigger
language plpgsql
set search_path = public
as $function$
begin
  if tg_op = 'INSERT' and new.status = 'confirmed' then
    if not public.running_as_table_owner('public.events'::regclass) then
      raise exception 'events are confirmed only by finalisation';
    end if;
  end if;

  if tg_op = 'UPDATE' then
    if new.group_id is distinct from old.group_id
       or new.created_by is distinct from old.created_by
       or new.recurrence_series_id is distinct from old.recurrence_series_id
    then
      raise exception 'event group, creator, and series link are immutable';
    end if;

    if new.status = 'confirmed' and old.status is distinct from 'confirmed' then
      if not public.running_as_table_owner('public.events'::regclass) then
        raise exception 'events are confirmed only by finalisation';
      end if;
      if old.status is distinct from 'proposing' then
        raise exception 'only a proposing event can be confirmed';
      end if;
    end if;

    if old.status = 'confirmed' and new.status = 'confirmed' then
      if new.starts_at is distinct from old.starts_at
         or new.ends_at is distinct from old.ends_at
      then
        raise exception 'a confirmed event time cannot be changed';
      end if;
    end if;

    if old.status = 'confirmed'
       and new.status is distinct from 'confirmed'
       and new.status is distinct from 'cancelled'
    then
      if new.status = 'completed'
         and public.running_as_table_owner('public.events'::regclass) then
        return new;
      end if;
      raise exception 'a confirmed event cannot change to that status';
    end if;
  end if;

  return new;
end;
$function$;
