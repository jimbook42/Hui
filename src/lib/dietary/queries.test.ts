import { describe, expect, it, vi } from "vitest";

import { listUserDietaryEntries } from "./queries";

describe("listUserDietaryEntries", () => {
  it("scopes the query to the signed-in user", async () => {
    const eqCalls: { column: string; value: string }[] = [];
    const supabase = {
      from: vi.fn(() => {
        const chain = {
          select: () => chain,
          eq: (column: string, value: string) => {
            eqCalls.push({ column, value });
            return chain;
          },
          order: () =>
            Promise.resolve({
              data: [
                {
                  id: "e1",
                  category: "requirement",
                  label: "Nuts",
                  notes: null,
                  share_with_all_groups: false,
                  dietary_entry_shares: [],
                },
              ],
              error: null,
            }),
        };
        return chain;
      }),
    } as unknown as Parameters<typeof listUserDietaryEntries>[0];

    const entries = await listUserDietaryEntries(supabase, "user-b");

    expect(eqCalls).toContainEqual({ column: "user_id", value: "user-b" });
    expect(entries).toHaveLength(1);
    expect(entries[0]?.label).toBe("Nuts");
  });
});
