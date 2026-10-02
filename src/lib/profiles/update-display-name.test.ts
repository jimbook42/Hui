import { describe, expect, it, vi } from "vitest";

import { updateOwnDisplayName } from "./update-display-name";

function createMockSupabase(options: {
  updateRows?: { id: string }[];
  updateError?: { message: string } | null;
}) {
  const update = vi.fn().mockReturnValue({
    eq: vi.fn().mockReturnValue({
      select: vi.fn().mockResolvedValue({
        data: options.updateRows ?? [{ id: "user-1" }],
        error: options.updateError ?? null,
      }),
    }),
  });

  return {
    client: {
      from: vi.fn().mockReturnValue({ update }),
    } as unknown as Parameters<typeof updateOwnDisplayName>[0],
    update,
  };
}

describe("updateOwnDisplayName", () => {
  it("updates with a trimmed display name", async () => {
    const { client, update } = createMockSupabase({});

    const result = await updateOwnDisplayName(client, "user-1", "  Alex  ");

    expect(result).toEqual({ ok: true });
    expect(update).toHaveBeenCalledWith({ display_name: "Alex" });
  });

  it("rejects empty and whitespace-only names", async () => {
    const { client, update } = createMockSupabase({});

    await expect(updateOwnDisplayName(client, "user-1", "   ")).resolves.toEqual({
      ok: false,
      error: "Display name must be between 1 and 80 characters.",
    });
    expect(update).not.toHaveBeenCalled();
  });

  it("rejects names longer than 80 characters", async () => {
    const { client, update } = createMockSupabase({});

    await expect(
      updateOwnDisplayName(client, "user-1", "a".repeat(81)),
    ).resolves.toEqual({
      ok: false,
      error: "Display name must be between 1 and 80 characters.",
    });
    expect(update).not.toHaveBeenCalled();
  });

  it("returns an error when the profile row is missing", async () => {
    const { client } = createMockSupabase({ updateRows: [] });

    await expect(updateOwnDisplayName(client, "user-1", "Alex")).resolves.toEqual({
      ok: false,
      error: "Profile not found.",
    });
  });

  it("surfaces database errors", async () => {
    const { client } = createMockSupabase({
      updateError: { message: "permission denied" },
    });

    await expect(updateOwnDisplayName(client, "user-1", "Alex")).resolves.toEqual({
      ok: false,
      error: "permission denied",
    });
  });
});
