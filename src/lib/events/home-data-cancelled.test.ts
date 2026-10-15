import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import { classifyHomeEvent } from "@/domain/events/home";
import { loadHomeData, splitHomeEvents } from "@/lib/events/home-data";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const GROUP_ID = "33333333-3333-4333-8333-333333333333";

function createCancelledHomeSupabase(cancelledAt: string): SupabaseClient {
  const events = [
    {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      title: "Cancelled dinner",
      status: "cancelled",
      group_id: GROUP_ID,
      created_by: USER_ID,
      location: null,
      starts_at: "2026-10-12T05:00:00.000Z",
      ends_at: null,
      timezone: "Pacific/Auckland",
      planning_target_date: null,
      cancelled_at: cancelledAt,
      groups: { name: "Friends" },
    },
  ];

  const memberships = [
    {
      role: "member",
      user_id: USER_ID,
      group_id: GROUP_ID,
      status: "active",
      groups: { id: GROUP_ID, name: "Friends" },
    },
  ];

  const resolveTable = (table: string) => {
    switch (table) {
      case "events":
        return events;
      case "group_memberships":
        return memberships;
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
      in: () => chain,
      or: () => chain,
      gte: (column: string, value: unknown) => {
        rows = rows.filter((row) => {
          const raw = (row as Record<string, unknown>)[column];
          if (typeof raw !== "string") {
            return false;
          }
          return raw >= String(value);
        });
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
    rpc: async () => ({ data: {}, error: null }),
  } as unknown as SupabaseClient;
}

describe("loadHomeData cancelled visibility", () => {
  it("includes recent cancelled hui with no attention", async () => {
    const client = createCancelledHomeSupabase("2026-10-10T12:00:00.000Z");
    const { events } = await loadHomeData(client, USER_ID);
    const cancelled = events.filter((event) => event.status === "cancelled");
    expect(cancelled).toHaveLength(1);
    expect(cancelled[0]?.bucket).toBe("cancelled");
    expect(cancelled[0]?.attention).toBeNull();
    expect(classifyHomeEvent({ status: "cancelled", startsAt: null, endsAt: null, viewerResponse: null, hasCandidate: false, hasPendingHostProposal: false }).attention).toBeNull();
    const sections = splitHomeEvents(events);
    expect(sections.cancelled).toHaveLength(1);
    expect(sections.attention).toHaveLength(0);
  });

  it("drops cancelled hui older than the visibility window", async () => {
    const client = createCancelledHomeSupabase("2025-01-01T12:00:00.000Z");
    const { events } = await loadHomeData(client, USER_ID);
    expect(events.some((event) => event.status === "cancelled")).toBe(false);
  });
});
