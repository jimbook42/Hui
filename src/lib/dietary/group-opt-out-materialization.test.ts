import { beforeEach, describe, expect, it, vi } from "vitest";

const { listActiveMembershipGroups } = vi.hoisted(() => ({
  listActiveMembershipGroups: vi.fn(),
}));

vi.mock("@/lib/groups/user-membership-groups", () => ({
  listActiveMembershipGroups,
}));

import { materializeSharesBeforeGroupOptOut } from "./group-opt-out-materialization";

type ShareInsert = { dietary_entry_id: string; group_id: string };

function createSupabaseMock(options: {
  allGroupsEntryIds: string[];
  insertErrors?: Map<string, { code: string; message: string }>;
  updateError?: { message: string } | null;
}) {
  const inserts: ShareInsert[] = [];
  let updatedIds: string[] = [];

  const supabase = {
    from(table: string) {
      if (table === "dietary_entries") {
        return {
          select() {
            return {
              eq() {
                return {
                  eq() {
                    return {
                      in(_column: string, entryIds: string[]) {
                        const rows = options.allGroupsEntryIds
                          .filter((id) => entryIds.includes(id))
                          .map((id) => ({ id }));
                        return Promise.resolve({ data: rows, error: null });
                      },
                    };
                  },
                };
              },
            };
          },
          update(payload: { share_with_all_groups: boolean }) {
            return {
              eq() {
                return {
                  in(_column: string, ids: string[]) {
                    if (options.updateError) {
                      return Promise.resolve({ error: options.updateError });
                    }
                    if (payload.share_with_all_groups === false) {
                      updatedIds = ids;
                    }
                    return Promise.resolve({ error: null });
                  },
                };
              },
            };
          },
        };
      }
      if (table === "dietary_entry_shares") {
        return {
          insert(row: ShareInsert) {
            inserts.push(row);
            const key = `${row.dietary_entry_id}:${row.group_id}`;
            const insertError = options.insertErrors?.get(key);
            if (insertError) {
              return Promise.resolve({ error: insertError });
            }
            return Promise.resolve({ error: null });
          },
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  };

  return { supabase, inserts, getUpdatedIds: () => updatedIds };
}

describe("materializeSharesBeforeGroupOptOut", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listActiveMembershipGroups.mockResolvedValue([
      { groupId: "g-a", groupName: "A" },
      { groupId: "g-b", groupName: "B" },
      { groupId: "g-target", groupName: "Target" },
    ]);
  });

  it("inserts explicit shares for other groups then clears share_with_all_groups", async () => {
    const { supabase, inserts, getUpdatedIds } = createSupabaseMock({
      allGroupsEntryIds: ["entry-1"],
    });

    const result = await materializeSharesBeforeGroupOptOut(
      supabase as never,
      "user-1",
      "g-target",
      ["entry-1"],
    );

    expect(result).toEqual({ ok: true });
    expect(inserts).toEqual([
      { dietary_entry_id: "entry-1", group_id: "g-a" },
      { dietary_entry_id: "entry-1", group_id: "g-b" },
    ]);
    expect(getUpdatedIds()).toEqual(["entry-1"]);
  });

  it("ignores duplicate share inserts (23505)", async () => {
    const { supabase, inserts } = createSupabaseMock({
      allGroupsEntryIds: ["entry-1"],
      insertErrors: new Map([
        ["entry-1:g-a", { code: "23505", message: "duplicate" }],
      ]),
    });

    const result = await materializeSharesBeforeGroupOptOut(
      supabase as never,
      "user-1",
      "g-target",
      ["entry-1"],
    );

    expect(result).toEqual({ ok: true });
    expect(inserts).toHaveLength(2);
  });

  it("no-ops when no entries use all-groups sharing", async () => {
    const { supabase, inserts } = createSupabaseMock({
      allGroupsEntryIds: [],
    });

    const result = await materializeSharesBeforeGroupOptOut(
      supabase as never,
      "user-1",
      "g-target",
      ["entry-1"],
    );

    expect(result).toEqual({ ok: true });
    expect(inserts).toEqual([]);
  });
});
