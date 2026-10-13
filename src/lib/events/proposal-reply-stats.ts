import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export type EventProposalReplyStats = {
  eligibleMemberCount: number;
  respondedMemberCount: number;
};

export async function getEventProposalReplyStats(
  supabase: SupabaseClient,
  eventId: string,
): Promise<EventProposalReplyStats | null> {
  const { data, error } = await supabase.rpc("event_proposal_reply_stats", {
    p_event_id: eventId,
  });

  if (error) {
    throw new Error(error.message);
  }
  if (!data || typeof data !== "object") {
    return null;
  }

  const record = data as Record<string, unknown>;
  return {
    eligibleMemberCount: Number(record.eligible_member_count ?? 0),
    respondedMemberCount: Number(record.responded_member_count ?? 0),
  };
}
