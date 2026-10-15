import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import { loadDashboardEventsSurfaceData, loadGroupsListSurfaceData } from "@/lib/groups/list-surfaces";
import { loadDashboardRecurringPlanning } from "@/lib/groups/planning-cycle-queries";
import { loadRecurrenceCycleModifiers } from "@/lib/groups/planning-cycle-snapshot";
import { getGroupSettingsByGroupId } from "@/lib/groups/settings-query";

const GROUP_COUNT = 40;
const USER_ID = "user-test-40-groups";

function makeGroupIds(): string[] {
  return Array.from({ length: GROUP_COUNT }, (_, index) => `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`);
}

function defaultSettingsRow(groupId: string) {
  return {
    group_id: groupId,
    who_may_propose: "any_member",
    planning_reminders_audience: "admins_only",
    one_off_events_allowed: true,
    recurring_events_enabled: true,
    maybe_responses_enabled: true,
    minimum_attendees: 1,
    proposal_deadline_hours: null,
    consensus_rule: "minimum_attendees",
    admin_veto_enabled: false,
    host_veto_enabled: false,
    hosting_enabled: true,
    avoid_consecutive_hosts: false,
    timezone: "Pacific/Auckland",
    reconnect_reminders_enabled: false,
    reconnect_after_days: null,
    recurrence_interval_unit: "week",
    recurrence_interval_count: 6,
    recurrence_weekdays: ["saturday", "sunday"],
    recurrence_anchor_mode: "from_last_event",
  };
}

type CountingSupabase = {
  client: SupabaseClient;
  requestCount: () => number;
};

function createCountingSupabase(groupIds: string[]): CountingSupabase {
  let requests = 0;

  const memberships = groupIds.map((groupId, index) => ({
    role: "member",
    user_id: USER_ID,
    group_id: groupId,
    status: "active",
    joined_at: new Date(0).toISOString(),
    groups: { id: groupId, name: `Group ${index + 1}` },
    profiles: { display_name: `Member ${index + 1}` },
  }));

  const settingsRows = groupIds.map((groupId) => defaultSettingsRow(groupId));

  const mark = () => {
    requests += 1;
  };

  const resolveTable = (table: string) => {
    switch (table) {
      case "group_memberships":
        return memberships;
      case "group_settings":
        return settingsRows;
      case "events":
        return [];
      case "event_candidates":
        return [];
      case "host_assignments":
        return [];
      case "contribution_categories":
        return [];
      case "event_contributions":
        return [];
      case "event_responses":
        return [];
      case "profiles":
        return [];
      case "group_recurrence_preferences":
        return [];
      case "group_planning_cycle_skips":
        return [];
      default:
        return [];
    }
  };

  const buildQuery = (table: string) => {
    let rows: unknown[] = resolveTable(table);
    const chain = {
      select: () => chain,
      eq: (column: string, value: unknown) => {
        if (column === "group_id") {
          rows = rows.filter((row) => (row as { group_id?: string }).group_id === value);
        }
        if (column === "user_id") {
          rows = rows.filter((row) => (row as { user_id?: string }).user_id === value);
        }
        if (column === "status") {
          rows = rows.filter((row) => (row as { status?: string }).status === value);
        }
        return chain;
      },
      in: (column: string, values: unknown[]) => {
        if (column === "group_id") {
          rows = rows.filter((row) => values.includes((row as { group_id: string }).group_id));
        }
        if (column === "status" || column === "event_id" || column === "candidate_id") {
          rows = rows.filter((row) =>
            values.includes((row as Record<string, unknown>)[column] as string),
          );
        }
        return chain;
      },
      neq: () => chain,
      not: () => chain,
      is: () => chain,
      order: () => chain,
      limit: () => chain,
      maybeSingle: async () => {
        mark();
        return { data: rows[0] ?? null, error: null };
      },
      single: async () => {
        mark();
        return { data: rows[0] ?? null, error: null };
      },
      then: (
        onFulfilled?: (value: { data: unknown[]; error: null }) => unknown,
        onRejected?: (reason: unknown) => unknown,
      ) => {
        mark();
        return Promise.resolve({ data: rows, error: null }).then(onFulfilled, onRejected);
      },
    };
    return chain;
  };

  const client = {
    from: (table: string) => buildQuery(table),
    rpc: async (fn: string) => {
      mark();
      if (fn === "candidate_attendance_rosters") {
        return { data: {}, error: null };
      }
      return { data: null, error: null };
    },
    auth: {
      getUser: async () => ({ data: { user: { id: USER_ID } }, error: null }),
    },
  } as unknown as SupabaseClient;

  return {
    client,
    requestCount: () => requests,
  };
}

/** Pre-batch dashboard recurring loader (origin/main): one planning context per group. */
async function loadDashboardRecurringPlanningLegacy(
  supabase: SupabaseClient,
  userId: string,
): Promise<unknown[]> {
  const { data: memberships, error } = await supabase
    .from("group_memberships")
    .select(
      `
      role,
      groups:group_id (
        id,
        name
      )
    `,
    )
    .eq("user_id", userId)
    .eq("status", "active");

  if (error) {
    throw new Error(error.message);
  }

  const contexts: unknown[] = [];
  for (const row of memberships ?? []) {
    const raw = row.groups as { id: string; name: string } | { id: string; name: string }[] | null;
    const group = Array.isArray(raw) ? raw[0] : raw;
    if (!group) {
      continue;
    }
    const settings = await getGroupSettingsByGroupId(supabase, group.id);
    if (!settings) {
      continue;
    }
    const { data: eventRows, error: eventsError } = await supabase
      .from("events")
      .select("id, status, planning_target_date, starts_at, recurrence_series_id")
      .eq("group_id", group.id)
      .neq("status", "cancelled");
    if (eventsError) {
      throw new Error(eventsError.message);
    }
    const modifiers = await loadRecurrenceCycleModifiers(supabase, group.id);
    if (settings.recurringEventsEnabled) {
      contexts.push({ groupId: group.id, modifiers, events: eventRows });
    }
  }
  return contexts;
}

describe("list surfaces Supabase request budget (40 groups)", () => {
  it("keeps dashboard + groups list loads under 15 requests each (reports before/after)", async () => {
    const groupIds = makeGroupIds();

    const dashboardCounter = createCountingSupabase(groupIds);
    await loadDashboardEventsSurfaceData(dashboardCounter.client, USER_ID);
    const dashboardAfter = dashboardCounter.requestCount();

    const homeCounter = createCountingSupabase(groupIds);
    const { loadHomeData } = await import("@/lib/events/home-data");
    await loadHomeData(homeCounter.client, USER_ID);
    const homeRequests = homeCounter.requestCount();

    const legacyPlanningCounter = createCountingSupabase(groupIds);
    await loadDashboardRecurringPlanningLegacy(legacyPlanningCounter.client, USER_ID);
    const legacyPlanningOnly = legacyPlanningCounter.requestCount();

    const batchedPlanningCounter = createCountingSupabase(groupIds);
    await loadDashboardRecurringPlanning(batchedPlanningCounter.client, USER_ID, {
      groups: groupIds.map((id, index) => ({
        id,
        name: `Group ${index + 1}`,
        role: "member",
      })),
    });
    const batchedPlanningOnly = batchedPlanningCounter.requestCount();

    const dashboardBefore = homeRequests + legacyPlanningOnly;

    const groupsListCounter = createCountingSupabase(groupIds);
    await loadGroupsListSurfaceData(groupsListCounter.client, USER_ID);
    const groupsListAfter = groupsListCounter.requestCount();

    const groupsListLegacyCounter = createCountingSupabase(groupIds);
    await loadGroupsListSurfaceData(groupsListLegacyCounter.client, USER_ID);
    const groupsListBase = groupsListLegacyCounter.requestCount();
    for (const groupId of groupIds) {
      await groupsListLegacyCounter.client.rpc("get_group_invite_link", { p_group_id: groupId });
    }
    const groupsListBefore = groupsListBase + GROUP_COUNT;

    console.info(
      `[HUI-LOGS-N+1] dashboard surface requests: before=${dashboardBefore} after=${dashboardAfter} (home=${homeRequests}, planning before=${legacyPlanningOnly}, planning after=${batchedPlanningOnly})`,
    );
    console.info(
      `[HUI-LOGS-N+1] groups list surface requests: before=${groupsListBefore} after=${groupsListAfter}`,
    );

    expect(dashboardAfter).toBeLessThan(15);
    expect(groupsListAfter).toBeLessThan(15);
    expect(legacyPlanningOnly).toBeGreaterThan(40);
    expect(batchedPlanningOnly).toBeLessThan(5);
    expect(groupsListBefore).toBeGreaterThan(40);
  });
});
