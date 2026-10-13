/**
 * Auto-confirm tie-break (mirrors `pick_auto_confirm_candidate` in Postgres):
 * among proposed times that pass consensus, choose earliest `starts_at`, then lowest `id`.
 */
export { compareCandidatesBySchedule, selectPassingCandidate } from "@/domain/scheduling/consensus";
