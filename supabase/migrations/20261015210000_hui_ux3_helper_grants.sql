-- HUI-UX3-fix4 (v0.18.7): revoke direct EXECUTE on internal confirm-rule helpers.

revoke execute on function public.member_has_yes_for_hosting(uuid, uuid) from public, anon;
grant execute on function public.member_has_yes_for_hosting(uuid, uuid) to authenticated;

revoke execute on function public.host_yes_required_for_candidate(uuid, uuid) from public, anon;
revoke execute on function public.event_accepted_host_user_id(uuid) from public, anon;

-- Only reached from SECURITY DEFINER RPCs (candidate_consensus, finalise, auto-confirm, etc.).
revoke execute on function public.host_yes_required_for_candidate(uuid, uuid) from authenticated;
revoke execute on function public.event_accepted_host_user_id(uuid) from authenticated;

-- authenticated EXECUTE on member_has_yes_for_hosting: proposed_host_remains_eligible
-- (SECURITY INVOKER) calls it when coordinate_event_host_after_attendance runs on attendance.

notify pgrst, 'reload schema';
