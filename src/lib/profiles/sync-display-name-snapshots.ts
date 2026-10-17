import type { SupabaseClient } from "@supabase/supabase-js";

import { emailLocalPart } from "./display-name-prompt";
import { normalizeDisplayName } from "./validation";

/**
 * Updates denormalised name snapshots on the viewer's own rows when they still
 * match the email local-part (typical Azure default). Does not touch rows the
 * user already customised to something else.
 */
export async function syncOwnDisplayNameSnapshots(
  supabase: SupabaseClient,
  userId: string,
  newDisplayName: string,
  email: string | undefined,
): Promise<void> {
  const normalizedNew = normalizeDisplayName(newDisplayName);
  const prefix = emailLocalPart(email);
  if (!normalizedNew || !prefix) {
    return;
  }

  const prefixLower = prefix.toLowerCase();

  const { data: hostRows } = await supabase
    .from("host_assignments")
    .select("id, display_name")
    .eq("user_id", userId);

  if (hostRows?.length) {
    const hostIds = hostRows
      .filter(
        (row) =>
          typeof row.display_name === "string" &&
          row.display_name.trim().toLowerCase() === prefixLower,
      )
      .map((row) => row.id as string);
    if (hostIds.length > 0) {
      await supabase
        .from("host_assignments")
        .update({ display_name: normalizedNew })
        .in("id", hostIds);
    }
  }

  const { data: contributionRows } = await supabase
    .from("event_contributions")
    .select("id, display_name")
    .eq("user_id", userId);

  if (contributionRows?.length) {
    const contributionIds = contributionRows
      .filter(
        (row) =>
          typeof row.display_name === "string" &&
          row.display_name.trim().toLowerCase() === prefixLower,
      )
      .map((row) => row.id as string);
    if (contributionIds.length > 0) {
      await supabase
        .from("event_contributions")
        .update({ display_name: normalizedNew })
        .in("id", contributionIds);
    }
  }
}
