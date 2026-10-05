-- Any active group member may pose a generic decision; lifecycle admin stays manager/creator.

create or replace function public.assert_can_create_event_decision(p_event_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_user uuid := auth.uid();
  v_group_id uuid;
  v_status public.event_status;
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;

  select e.group_id, e.status
  into v_group_id, v_status
  from public.events e
  where e.id = p_event_id;

  if v_group_id is null then
    raise exception 'event not found';
  end if;

  if not public.is_active_member(v_group_id) then
    raise exception 'not an active group member';
  end if;

  if v_status in ('cancelled', 'completed', 'draft') then
    raise exception 'decisions are closed for this event';
  end if;
end;
$function$;

create or replace function public.create_event_decision(
  p_event_id uuid,
  p_question text,
  p_option_labels text[]
)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_user uuid := auth.uid();
  v_group_id uuid;
  v_decision_id uuid;
  v_label text;
  v_pos smallint := 0;
begin
  perform public.assert_can_create_event_decision(p_event_id);

  p_question := nullif(trim(coalesce(p_question, '')), '');
  if p_question is null or char_length(p_question) < 1 or char_length(p_question) > 200 then
    raise exception 'question must be between 1 and 200 characters';
  end if;

  if p_option_labels is null or array_length(p_option_labels, 1) is null or array_length(p_option_labels, 1) < 2 then
    raise exception 'at least two options are required';
  end if;

  if array_length(p_option_labels, 1) > 12 then
    raise exception 'at most twelve options are allowed';
  end if;

  select e.group_id into v_group_id from public.events e where e.id = p_event_id;

  insert into public.event_decisions (event_id, group_id, question, created_by)
  values (p_event_id, v_group_id, p_question, v_user)
  returning id into v_decision_id;

  foreach v_label in array p_option_labels loop
    v_label := nullif(trim(coalesce(v_label, '')), '');
    if v_label is null or char_length(v_label) < 1 or char_length(v_label) > 120 then
      raise exception 'each option must be between 1 and 120 characters';
    end if;
    insert into public.event_decision_options (decision_id, label, position)
    values (v_decision_id, v_label, v_pos);
    v_pos := v_pos + 1;
  end loop;

  return v_decision_id;
end;
$function$;

create or replace function public.update_event_decision_draft(
  p_decision_id uuid,
  p_question text,
  p_option_labels text[]
)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_event_id uuid;
  v_created_by uuid;
  v_status public.event_decision_status;
  v_response_count int;
  v_label text;
  v_pos smallint := 0;
  v_user uuid := auth.uid();
begin
  select ed.event_id, ed.created_by, ed.status
  into v_event_id, v_created_by, v_status
  from public.event_decisions ed
  where ed.id = p_decision_id;

  if v_event_id is null then
    raise exception 'decision not found';
  end if;

  if v_created_by = v_user then
    perform public.assert_can_create_event_decision(v_event_id);
  else
    perform public.assert_can_manage_event_decisions(v_event_id);
  end if;

  if v_status <> 'open' then
    raise exception 'only open decisions can be edited';
  end if;

  select count(*)::int into v_response_count
  from public.event_decision_responses r
  where r.decision_id = p_decision_id;

  if v_response_count > 0 then
    raise exception 'cannot edit a decision after members have responded';
  end if;

  p_question := nullif(trim(coalesce(p_question, '')), '');
  if p_question is null or char_length(p_question) < 1 or char_length(p_question) > 200 then
    raise exception 'question must be between 1 and 200 characters';
  end if;

  if p_option_labels is null or array_length(p_option_labels, 1) is null or array_length(p_option_labels, 1) < 2 then
    raise exception 'at least two options are required';
  end if;

  if array_length(p_option_labels, 1) > 12 then
    raise exception 'at most twelve options are allowed';
  end if;

  update public.event_decisions
  set question = p_question,
      updated_at = now()
  where id = p_decision_id;

  delete from public.event_decision_options where decision_id = p_decision_id;

  foreach v_label in array p_option_labels loop
    v_label := nullif(trim(coalesce(v_label, '')), '');
    if v_label is null or char_length(v_label) < 1 or char_length(v_label) > 120 then
      raise exception 'each option must be between 1 and 120 characters';
    end if;
    insert into public.event_decision_options (decision_id, label, position)
    values (p_decision_id, v_label, v_pos);
    v_pos := v_pos + 1;
  end loop;
end;
$function$;

grant execute on function public.assert_can_create_event_decision(uuid) to authenticated, service_role;
