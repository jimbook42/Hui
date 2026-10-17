-- v0.18.25: optional decline reasons on new "can't come" answers are visible to the group.

alter table public.event_responses
  add column if not exists note_shared_with_group boolean not null default false;

comment on column public.event_responses.note_shared_with_group is
  'When true and response is no, note is included in candidate_attendance_roster for members. Legacy rows stay false.';

create or replace function public.candidate_attendance_roster(p_candidate_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  v_event_id uuid;
  v_group_id uuid;
  v_viewer uuid := auth.uid();
  v_maybe_enabled boolean;
  v_members jsonb := '[]'::jsonb;
  r record;
  v_response text;
  v_submitted_late boolean;
  v_note text;
  v_note_shared boolean;
  v_decline_reason text;
begin
  if v_viewer is null then
    raise exception 'not authenticated';
  end if;

  select c.event_id, c.group_id
  into v_event_id, v_group_id
  from public.event_candidates c
  where c.id = p_candidate_id;

  if v_event_id is null or not public.is_active_member(v_group_id) then
    raise exception 'candidate not found';
  end if;

  select gs.maybe_responses_enabled
  into v_maybe_enabled
  from public.group_settings gs
  where gs.group_id = v_group_id;

  for r in
    select m.user_id, p.display_name
    from public.group_memberships m
    join public.profiles p on p.id = m.user_id
    where m.group_id = v_group_id
      and m.status = 'active'
    order by p.display_name collate "C", m.user_id
  loop
    select er.response::text,
      er.submitted_late,
      er.note,
      coalesce(er.note_shared_with_group, false)
    into v_response, v_submitted_late, v_note, v_note_shared
    from public.event_responses er
    where er.candidate_id = p_candidate_id
      and er.user_id = r.user_id;

    v_decline_reason := case
      when v_response = 'no'
        and v_note_shared
        and v_note is not null
        and pg_catalog.btrim(v_note) <> ''
      then pg_catalog.btrim(v_note)
      else null
    end;

    v_members := v_members || jsonb_build_array(
      jsonb_build_object(
        'user_id', r.user_id,
        'display_name', r.display_name,
        'response', v_response,
        'submitted_late', coalesce(v_submitted_late, false),
        'decline_reason', v_decline_reason
      )
    );
  end loop;

  for r in
    select er.user_id,
      er.response::text as response,
      er.submitted_late,
      er.note,
      coalesce(er.note_shared_with_group, false) as note_shared_with_group
    from public.event_responses er
    join public.profiles p on p.id = er.user_id
    where er.candidate_id = p_candidate_id
      and er.event_id = v_event_id
      and p.account_deleted_at is not null
      and not exists (
        select 1
        from public.group_memberships m
        where m.group_id = v_group_id
          and m.user_id = er.user_id
          and m.status = 'active'
      )
    order by er.user_id
  loop
    v_decline_reason := case
      when r.response = 'no'
        and r.note_shared_with_group
        and r.note is not null
        and pg_catalog.btrim(r.note) <> ''
      then pg_catalog.btrim(r.note)
      else null
    end;

    v_members := v_members || jsonb_build_array(
      jsonb_build_object(
        'user_id', r.user_id,
        'display_name', 'Former member',
        'response', r.response,
        'submitted_late', coalesce(r.submitted_late, false),
        'decline_reason', v_decline_reason
      )
    );
  end loop;

  return jsonb_build_object(
    'maybe_responses_enabled', coalesce(v_maybe_enabled, true),
    'members', v_members
  );
end;
$function$;

comment on function public.candidate_attendance_roster(uuid) is
  'Member-visible attendance for one candidate. Decline reasons appear only when note_shared_with_group is true (new can''t-come saves).';
