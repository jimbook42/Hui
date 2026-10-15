-- HUI-0183: do not notify the member who was both assigner and suggested host (e.g. organiser picked as host).

create or replace function public.trg_host_assignments_notifications()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_event_title text;
  v_group_name text;
begin
  select e.title, g.name
  into v_event_title, v_group_name
  from public.events e
  join public.groups g on g.id = e.group_id
  where e.id = new.event_id;

  if tg_op = 'INSERT' then
    if new.status = 'proposed'
      and new.user_id is not null
      and new.assigned_by is distinct from new.user_id then
      perform public.queue_member_notification(
        new.user_id,
        'host_proposed'::public.notification_kind,
        'Host request',
        format(
          'Hui has suggested you host "%s" in %s.',
          coalesce(v_event_title, 'an event'),
          coalesce(v_group_name, 'your group')
        ),
        new.group_id,
        new.event_id,
        'host_proposed:' || new.id::text
      );
    end if;
  elsif tg_op = 'UPDATE'
    and old.status = 'proposed'
    and new.status in ('accepted', 'declined', 'swapped_out')
    and new.assigned_by is not null
    and new.assigned_by is distinct from new.user_id then
    if new.status = 'accepted' then
      perform public.queue_member_notification(
        new.assigned_by,
        'host_accepted'::public.notification_kind,
        'Host accepted',
        format(
          '%s accepted hosting "%s".',
          coalesce(new.display_name, 'The host'),
          coalesce(v_event_title, 'the event')
        ),
        new.group_id,
        new.event_id,
        'host_response:' || new.id::text || ':accepted'
      );
    elsif new.status = 'declined' then
      perform public.queue_member_notification(
        new.assigned_by,
        'host_declined'::public.notification_kind,
        'Host declined',
        format(
          '%s declined hosting "%s".',
          coalesce(new.display_name, 'The host'),
          coalesce(v_event_title, 'the event')
        ),
        new.group_id,
        new.event_id,
        'host_response:' || new.id::text || ':declined'
      );
    elsif new.status = 'swapped_out' and old.status = 'proposed' then
      perform public.queue_member_notification(
        new.assigned_by,
        'host_declined'::public.notification_kind,
        'Host swap requested',
        format(
          '%s asked to swap hosting for "%s".',
          coalesce(new.display_name, 'The host'),
          coalesce(v_event_title, 'the event')
        ),
        new.group_id,
        new.event_id,
        'host_response:' || new.id::text || ':swapped'
      );
    end if;
  end if;

  return new;
end;
$function$;
