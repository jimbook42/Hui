import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import { loadHomeData } from "@/lib/events/home-data";

const VIEWER_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_ID = "22222222-2222-4222-8222-222222222222";
const GROUP_ID = "33333333-3333-4333-8333-333333333333";
const EVENT_ID = "44444444-4444-4444-8444-444444444444";
const CANDIDATE_ID = "55555555-5555-4555-8555-555555555555";

function createProposerReadyToConfirmSupabase(): SupabaseClient {
  const events = [
    {
      id: EVENT_ID,
      title: "Brunch",
      status: "proposing",
      group_id: GROUP_ID,
      created_by: VIEWER_ID,
      location: null,
      starts_at: null,
      ends_at: null,
      timezone: "Pacific/Auckland",
      planning_target_date: null,
      groups: { name: "Test group" },
    },
  ];

  const memberships = [
    {
      role: "admin",
      user_id: VIEWER_ID,
      group_id: GROUP_ID,
      status: "active",
      consensus_required: false,
      groups: { id: GROUP_ID, name: "Test group" },
      profiles: { display_name: "Proposer" },
    },
    {
      role: "member",
      user_id: OTHER_ID,
      group_id: GROUP_ID,
      status: "active",
      consensus_required: false,
      profiles: { display_name: "Other member" },
    },
  ];

  /** Self-only RLS: viewer sees only their own row on event_responses. */
  const eventResponses = [
    { candidate_id: CANDIDATE_ID, user_id: VIEWER_ID, response: "no" as const },
  ];

  const resolveTable = (table: string) => {
    switch (table) {
      case "events":
        return events;
      case "group_memberships":
        return memberships;
      case "group_settings":
        return [
          {
            group_id: GROUP_ID,
            timezone: "Pacific/Auckland",
            maybe_responses_enabled: true,
            who_may_propose: "any_member",
            one_off_events_allowed: true,
            recurring_events_enabled: true,
            minimum_attendees: 1,
            consensus_rule: "minimum_attendees",
          },
        ];
      case "event_candidates":
        return [
          {
            id: CANDIDATE_ID,
            event_id: EVENT_ID,
            starts_at: new Date(Date.now() + 86400000).toISOString(),
            ends_at: null,
            status: "proposed",
          },
        ];
      case "event_responses":
        return eventResponses;
      case "host_assignments":
      case "contribution_categories":
      case "event_contributions":
      case "event_decisions":
      case "event_decision_responses":
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
        rows = rows.filter((row) => (row as Record<string, unknown>)[column] === value);
        return chain;
      },
      in: (column: string, values: unknown[]) => {
        rows = rows.filter((row) =>
          values.includes((row as Record<string, unknown>)[column] as string),
        );
        return chain;
      },
      neq: () => chain,
      not: () => chain,
      is: () => chain,
      order: () => chain,
      limit: () => chain,
      maybeSingle: async () => ({ data: rows[0] ?? null, error: null }),
      single: async () => ({ data: rows[0] ?? null, error: null }),
      then: (
        onFulfilled?: (value: { data: unknown[]; error: null }) => unknown,
        onRejected?: (reason: unknown) => unknown,
      ) => Promise.resolve({ data: rows, error: null }).then(onFulfilled, onRejected),
    };
    return chain;
  };

  return {
    from: (table: string) => buildQuery(table),
    rpc: async (fn: string, args?: { p_candidate_ids?: string[] }) => {
      if (fn === "candidate_attendance_rosters") {
        const ids = args?.p_candidate_ids ?? [];
        expect(ids).toContain(CANDIDATE_ID);
        return {
          data: {
            [CANDIDATE_ID]: {
              maybe_responses_enabled: true,
              members: [
                {
                  user_id: VIEWER_ID,
                  display_name: "Proposer",
                  response: "no",
                  submitted_late: false,
                },
                {
                  user_id: OTHER_ID,
                  display_name: "Other member",
                  response: "yes",
                  submitted_late: false,
                },
              ],
            },
          },
          error: null,
        };
      }
      return { data: null, error: null };
    },
  } as unknown as SupabaseClient;
}

describe("loadHomeData ready-to-confirm", () => {
  it("counts another member's yes via candidate_attendance_rosters under self-only RLS", async () => {
    const client = createProposerReadyToConfirmSupabase();
    const { events } = await loadHomeData(client, VIEWER_ID);

    const event = events.find((row) => row.id === EVENT_ID);
    expect(event?.attention).toBe("confirm");
  });
});
