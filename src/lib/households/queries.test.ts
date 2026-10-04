import { describe, expect, it, vi } from "vitest";

import { listUserHouseholdsByGroup } from "./queries";

describe("listUserHouseholdsByGroup", () => {
  it("batches household lookups instead of per-group waterfalls", async () => {
    const fromCalls: string[] = [];
    const supabase = {
      from: vi.fn((table: string) => {
        fromCalls.push(table);
        if (table === "household_members") {
          let phase: "user-groups" | "members" = "user-groups";
          const chain = {
            select: () => chain,
            eq: () => chain,
            in: (column: string) => {
              if (column === "household_id") {
                phase = "members";
              }
              return chain;
            },
            order: () =>
              Promise.resolve({
                data:
                  phase === "user-groups"
                    ? [{ group_id: "g1", household_id: "h1" }]
                    : [
                        {
                          household_id: "h1",
                          user_id: "u1",
                          profiles: { display_name: "Alex" },
                        },
                      ],
                error: null,
              }),
            then: (
              resolve: (value: { data: unknown; error: null }) => void,
              reject?: (reason: unknown) => void,
            ) => {
              if (phase === "user-groups") {
                return Promise.resolve({
                  data: [{ group_id: "g1", household_id: "h1" }],
                  error: null,
                }).then(resolve, reject);
              }
              return Promise.reject(new Error("unexpected then"));
            },
          };
          return chain;
        }
        if (table === "households") {
          return {
            select: () => ({
              in: () =>
                Promise.resolve({
                  data: [{ id: "h1", name: "Home" }],
                  error: null,
                }),
            }),
          };
        }
        throw new Error(`Unexpected table ${table}`);
      }),
    } as unknown as Parameters<typeof listUserHouseholdsByGroup>[0];

    const groups = [{ groupId: "g1", groupName: "Friends" }];
    const result = await listUserHouseholdsByGroup(supabase, "u1", groups);

    expect(result).toHaveLength(1);
    expect(result[0]?.household?.name).toBe("Home");
    expect(result[0]?.household?.members).toEqual([
      { userId: "u1", displayName: "Alex" },
    ]);
    expect(fromCalls.filter((table) => table === "household_members")).toHaveLength(2);
    expect(fromCalls.filter((table) => table === "households")).toHaveLength(1);
  });
});
