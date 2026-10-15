-- HUI-0183: batched member-visible attendance rosters (security definer; bypasses event_responses RLS).

create or replace function public.candidate_attendance_rosters(p_candidate_ids uuid[])
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  v_viewer uuid := auth.uid();
  v_result jsonb := '{}'::jsonb;
  v_id uuid;
  v_group_id uuid;
begin
  if v_viewer is null then
    raise exception 'not authenticated';
  end if;

  if p_candidate_ids is null or cardinality(p_candidate_ids) > 50 then
    raise exception 'too many candidate ids';
  end if;

  foreach v_id in array p_candidate_ids
  loop
    select c.group_id
    into v_group_id
    from public.event_candidates c
    where c.id = v_id;

    if v_group_id is not null and public.is_active_member(v_group_id) then
      v_result := v_result || jsonb_build_object(
        v_id::text,
        public.candidate_attendance_roster(v_id)
      );
    end if;
  end loop;

  return v_result;
end;
$function$;

revoke all on function public.candidate_attendance_rosters(uuid[]) from public, anon;
grant execute on function public.candidate_attendance_rosters(uuid[]) to authenticated, service_role;

comment on function public.candidate_attendance_rosters(uuid[]) is
  'Member-visible attendance rosters for many candidates in one call. Skips ids the caller cannot access.';
