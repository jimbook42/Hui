import { describe, expect, it, vi } from "vitest";

import { ensureUserProfile } from "./ensure-profile";

function createMockSupabase(options: {
  existingProfile: boolean;
  insertError?: { code: string; message: string } | null;
}) {
  const insert = vi.fn().mockResolvedValue({ error: options.insertError ?? null });
  const from = vi.fn().mockReturnValue({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({
          data: options.existingProfile ? { id: "user-1" } : null,
          error: null,
        }),
      }),
    }),
    insert,
  });

  return {
    client: { from } as unknown as Parameters<typeof ensureUserProfile>[0],
    insert,
  };
}

describe("ensureUserProfile", () => {
  it("does not insert when a profile already exists", async () => {
    const { client, insert } = createMockSupabase({ existingProfile: true });

    const result = await ensureUserProfile(client, "user-1", "Isaac Tull");

    expect(result).toEqual({ ok: true, created: false });
    expect(insert).not.toHaveBeenCalled();
  });

  it("inserts with the preferred name when the profile row is missing", async () => {
    const { client, insert } = createMockSupabase({ existingProfile: false });

    const result = await ensureUserProfile(client, "user-1", "Isaac Tull");

    expect(result).toEqual({ ok: true, created: true });
    expect(insert).toHaveBeenCalledWith({
      id: "user-1",
      display_name: "Isaac Tull",
    });
  });

  it("treats duplicate insert as idempotent success", async () => {
    const { client } = createMockSupabase({
      existingProfile: false,
      insertError: { code: "23505", message: "duplicate key" },
    });

    const result = await ensureUserProfile(client, "user-1", "Isaac Tull");

    expect(result).toEqual({ ok: true, created: false });
  });
});
