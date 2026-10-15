import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { loadHomeData } from "@/lib/events/home-data";
import { loadRecentCancelledEventsForGroups } from "@/lib/events/recent-cancelled-for-groups";
import { listGroupPreviews } from "@/lib/groups/previews";
import { loadDashboardRecurringPlanning } from "@/lib/groups/planning-cycle-queries";

/** Data loaded for the dashboard events column (home + recurring planning). */
export async function loadDashboardEventsSurfaceData(
  supabase: SupabaseClient,
  userId: string,
) {
  const home = await loadHomeData(supabase, userId);
  const recurringPlanning = await loadDashboardRecurringPlanning(supabase, userId, {
    groups: home.groups,
  });
  return { ...home, recurringPlanning };
}

/** Data loaded for /groups list (no per-group invite RPCs on initial render). */
export async function loadGroupsListSurfaceData(supabase: SupabaseClient, userId: string) {
  const home = await loadHomeData(supabase, userId, { skipRosters: true });
  const groupIds = home.groups.map((group) => group.id);
  const [previews, recentCancelledByGroup] = await Promise.all([
    listGroupPreviews(supabase, groupIds),
    loadRecentCancelledEventsForGroups(supabase, groupIds),
  ]);
  return { home, previews, recentCancelledByGroup };
}
