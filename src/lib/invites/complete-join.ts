import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { parseInviteJoinPayload } from "@/domain/invites/resolve";
import { resolvePostInviteJoinPath } from "@/lib/invites/post-join-redirect";

/** Join via invite token and return the path the member should land on. */
export async function completeInviteJoinForUser(
  supabase: SupabaseClient,
  userId: string,
  token: string,
  focusEventId?: string | null,
): Promise<string> {
  const { data, error } = await supabase.rpc("join_group_via_invite", {
    p_token: token,
  });

  if (error) {
    throw new Error(error.message);
  }

  const result = parseInviteJoinPayload(data);
  if (result.status === "invalid") {
    throw new Error("This invite link is no longer valid.");
  }

  const groupId = result.groupId;
  return resolvePostInviteJoinPath(supabase, groupId, userId, focusEventId);
}
