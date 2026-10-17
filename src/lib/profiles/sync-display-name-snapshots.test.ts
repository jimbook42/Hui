import { describe, expect, it, vi } from "vitest";

import { syncOwnDisplayNameSnapshots } from "./sync-display-name-snapshots";

describe("syncOwnDisplayNameSnapshots", () => {
  it("updates host and contribution rows that still match the email prefix", async () => {
    const hostUpdate = vi.fn().mockReturnValue({ in: vi.fn().mockResolvedValue({ error: null }) });
    const contributionUpdate = vi
      .fn()
      .mockReturnValue({ in: vi.fn().mockResolvedValue({ error: null }) });

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "host_assignments") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: [
                  { id: "h1", display_name: "isaac" },
                  { id: "h2", display_name: "Custom Host" },
                ],
              }),
            }),
            update: hostUpdate,
          };
        }
        if (table === "event_contributions") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: [{ id: "c1", display_name: "Isaac" }],
              }),
            }),
            update: contributionUpdate,
          };
        }
        throw new Error(`unexpected table ${table}`);
      }),
    };

    await syncOwnDisplayNameSnapshots(
      supabase as never,
      "user-1",
      "Isaac Tull",
      "isaac@outlook.com",
    );

    expect(hostUpdate).toHaveBeenCalledWith({ display_name: "Isaac Tull" });
    expect(contributionUpdate).toHaveBeenCalledWith({ display_name: "Isaac Tull" });
  });
});
