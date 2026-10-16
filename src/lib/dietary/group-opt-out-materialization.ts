import type { SupabaseClient } from "@supabase/supabase-js";

import { listActiveMembershipGroups } from "@/lib/groups/user-membership-groups";

type MaterializeResult = { ok: true } | { ok: false; error: string };

/**
 * Before removing sharing for one group, entries with share_with_all_groups must get explicit
 * shares for every other active membership group so turning one group off does not leak via the flag.
 */
export async function materializeSharesBeforeGroupOptOut(
  supabase: SupabaseClient,
  userId: string,
  targetGroupId: string,
  entryIds: string[],
): Promise<MaterializeResult> {
  if (entryIds.length === 0) {
    return { ok: true };
  }

  const { data: allGroupsEntries, error: entriesError } = await supabase
    .from("dietary_entries")
    .select("id")
    .eq("user_id", userId)
    .eq("share_with_all_groups", true)
    .in("id", entryIds);

  if (entriesError) {
    return { ok: false, error: entriesError.message };
  }

  const materializeIds = (allGroupsEntries ?? []).map((row) => row.id as string);
  if (materializeIds.length === 0) {
    return { ok: true };
  }

  const membershipGroups = await listActiveMembershipGroups(supabase, userId);
  const otherGroupIds = membershipGroups
    .map((group) => group.groupId)
    .filter((groupId) => groupId !== targetGroupId);

  for (const entryId of materializeIds) {
    for (const groupId of otherGroupIds) {
      const { error: insertError } = await supabase.from("dietary_entry_shares").insert({
        dietary_entry_id: entryId,
        group_id: groupId,
      });
      if (insertError && insertError.code !== "23505") {
        return { ok: false, error: insertError.message };
      }
    }
  }

  const { error: updateError } = await supabase
    .from("dietary_entries")
    .update({ share_with_all_groups: false })
    .eq("user_id", userId)
    .in("id", materializeIds);

  if (updateError) {
    return { ok: false, error: updateError.message };
  }

  return { ok: true };
}
