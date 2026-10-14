import "server-only";

import { parseInviteResolvePayload } from "@/domain/invites/resolve";
import { parseJoinPathFromNext } from "@/lib/invites/join-path";
import { createClient } from "@/lib/supabase/server";

export async function loadInviteGroupNameForAuthNext(
  next: string,
): Promise<string | null> {
  const join = parseJoinPathFromNext(next);
  if (!join) {
    return null;
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("resolve_group_invite", {
    p_token: join.token,
    p_focus_event_id: join.focusEventId,
  });
  if (error) {
    return null;
  }
  const resolved = parseInviteResolvePayload(data);
  if (resolved.status === "invalid") {
    return null;
  }
  return resolved.groupName.trim() || null;
}
