import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { StandingAvailabilityWindow } from "@/domain/scheduling/standing-availability";
import {
  rankTimeRecommendations,
  type TimeRecommendation,
} from "@/domain/scheduling/time-recommendations";
import { createSecretSupabaseClient } from "@/lib/supabase/admin";

type StandingRow = {
  user_id: string;
  group_id: string;
  day_of_week: number;
  start_minute: number;
  end_minute: number;
  kind: "usually_available" | "usually_unavailable";
  id: string;
};

function mapStandingRow(row: StandingRow): StandingAvailabilityWindow {
  return {
    id: row.id,
    groupId: row.group_id,
    dayOfWeek: row.day_of_week,
    startMinute: row.start_minute,
    endMinute: row.end_minute,
    kind: row.kind,
  };
}

async function listActiveMemberUserIds(
  supabase: SupabaseClient,
  groupId: string,
): Promise<string[]> {
  const { data, error } = await supabase
    .from("group_memberships")
    .select("user_id")
    .eq("group_id", groupId)
    .eq("status", "active");

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => row.user_id as string);
}

/**
 * Standing rows are owner-private under RLS. Recommendations use the server secret client
 * only after the caller membership check — aggregated explanations are returned to the UI.
 */
async function loadStandingByUserForGroup(
  groupId: string,
): Promise<Map<string, StandingAvailabilityWindow[]>> {
  const byUser = new Map<string, StandingAvailabilityWindow[]>();
  try {
    const admin = createSecretSupabaseClient();
    const { data, error } = await admin
      .from("group_member_standing_availability")
      .select("id, group_id, user_id, day_of_week, start_minute, end_minute, kind")
      .eq("group_id", groupId);

    if (error) {
      return byUser;
    }

    for (const row of (data ?? []) as StandingRow[]) {
      const list = byUser.get(row.user_id) ?? [];
      list.push(mapStandingRow(row));
      byUser.set(row.user_id, list);
    }
  } catch {
    return byUser;
  }

  return byUser;
}

export async function loadProposalTimeRecommendations(
  supabase: SupabaseClient,
  viewerUserId: string,
  groupId: string,
  options: {
    timeZone: string;
    planningTargetDate: string | null;
    maybeResponsesEnabled: boolean;
    todayDateOnly: string;
  },
): Promise<TimeRecommendation[]> {
  const { data: membership, error: membershipError } = await supabase
    .from("group_memberships")
    .select("status")
    .eq("group_id", groupId)
    .eq("user_id", viewerUserId)
    .maybeSingle();

  if (membershipError) {
    throw membershipError;
  }
  if (!membership || membership.status !== "active") {
    return [];
  }

  const memberIds = await listActiveMemberUserIds(supabase, groupId);
  if (memberIds.length === 0) {
    return [];
  }

  const standingByUser = await loadStandingByUserForGroup(groupId);
  const members = memberIds.map((userId) => ({
    userId,
    standingWindows: standingByUser.get(userId) ?? [],
  }));

  const hasAnySignal =
    members.some((member) => member.standingWindows.length > 0) || memberIds.length > 0;
  if (!hasAnySignal) {
    return [];
  }

  const recommendations = rankTimeRecommendations({
    memberCount: memberIds.length,
    members,
    timeZone: options.timeZone,
    planningTargetDate: options.planningTargetDate,
    todayDateOnly: options.todayDateOnly,
    existingCandidates: [],
    maybeResponsesEnabled: options.maybeResponsesEnabled,
  });

  return recommendations;
}
