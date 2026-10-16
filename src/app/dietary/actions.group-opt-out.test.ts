import { beforeEach, describe, expect, it, vi } from "vitest";

const { getServerAuthUser, getServerSupabase, materializeSharesBeforeGroupOptOut } = vi.hoisted(
  () => ({
    getServerAuthUser: vi.fn(),
    getServerSupabase: vi.fn(),
    materializeSharesBeforeGroupOptOut: vi.fn(),
  }),
);

vi.mock("@/lib/auth/server-session", () => ({
  getServerAuthUser,
  getServerSupabase,
}));

vi.mock("@/lib/dietary/group-opt-out-materialization", () => ({
  materializeSharesBeforeGroupOptOut,
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import {
  setDietaryGroupShareAction,
  unshareDietaryEntryAction,
} from "@/app/dietary/actions";

describe("dietary group opt-out actions", () => {
  const user = { id: "00000000-0000-4000-8000-000000000010", email: "u@hui.test" };
  const groupId = "00000000-0000-4000-8000-000000000001";
  const entryId = "00000000-0000-4000-8000-000000000002";

  beforeEach(() => {
    vi.clearAllMocks();
    getServerAuthUser.mockResolvedValue(user);
    materializeSharesBeforeGroupOptOut.mockResolvedValue({ ok: true });
  });

  it("setDietaryGroupShareAction off materializes before deleting group shares", async () => {
    const deleteShares = vi.fn().mockResolvedValue({ error: null });
    const deleteEmpty = vi.fn().mockReturnValue({
      eq: () => ({
        eq: () => Promise.resolve({ error: null }),
      }),
    });
    const listEntries = vi.fn().mockResolvedValue({
      data: [{ id: entryId }],
      error: null,
    });

    getServerSupabase.mockResolvedValue({
      from(table: string) {
        if (table === "dietary_entries") {
          return {
            select: () => ({
              eq: () => Promise.resolve(listEntries()),
            }),
          };
        }
        if (table === "dietary_empty_group_shares") {
          return { delete: deleteEmpty };
        }
        if (table === "dietary_entry_shares") {
          return {
            delete: () => ({
              eq: () => ({
                in: deleteShares,
              }),
            }),
          };
        }
        throw new Error(table);
      },
    });

    const formData = new FormData();
    formData.set("group_id", groupId);
    formData.set("enabled", "false");

    const result = await setDietaryGroupShareAction({}, formData);

    expect(result.error).toBeUndefined();
    expect(materializeSharesBeforeGroupOptOut).toHaveBeenCalledWith(
      expect.anything(),
      user.id,
      groupId,
      [entryId],
    );
    expect(deleteShares).toHaveBeenCalled();
  });

  it("unshareDietaryEntryAction materializes before deleting one share", async () => {
    const deleteShare = vi.fn().mockResolvedValue({ error: null });
    getServerSupabase.mockResolvedValue({
      from(table: string) {
        if (table === "dietary_entries") {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  maybeSingle: () => Promise.resolve({ data: { id: entryId }, error: null }),
                }),
              }),
            }),
          };
        }
        if (table === "dietary_entry_shares") {
          return {
            delete: () => ({
              eq: () => ({
                eq: deleteShare,
              }),
            }),
          };
        }
        throw new Error(table);
      },
    });

    const formData = new FormData();
    formData.set("entry_id", entryId);
    formData.set("group_id", groupId);

    const result = await unshareDietaryEntryAction({}, formData);

    expect(result.error).toBeUndefined();
    expect(materializeSharesBeforeGroupOptOut).toHaveBeenCalledWith(
      expect.anything(),
      user.id,
      groupId,
      [entryId],
    );
    expect(deleteShare).toHaveBeenCalled();
  });

  it("returns an error when materialization fails", async () => {
    materializeSharesBeforeGroupOptOut.mockResolvedValue({
      ok: false,
      error: "db failed",
    });

    getServerSupabase.mockResolvedValue({
      from(table: string) {
        if (table === "dietary_entries") {
          return {
            select: () => ({
              eq: () => Promise.resolve({
                data: [{ id: entryId }],
                error: null,
              }),
            }),
          };
        }
        throw new Error(table);
      },
    });

    const formData = new FormData();
    formData.set("group_id", groupId);
    formData.set("enabled", "false");

    const result = await setDietaryGroupShareAction({}, formData);
    expect(result).toEqual({ error: "db failed" });
  });
});
