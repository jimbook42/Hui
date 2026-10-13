import { describe, expect, it } from "vitest";

import { deriveDietarySharingScope } from "./sharing-scope";
import type { UserDietaryEntry } from "@/lib/dietary/types";

describe("deriveDietarySharingScope", () => {
  const groups = [{ groupId: "g1", groupName: "Friends" }];

  it("reports global off when no entries use all-groups sharing", () => {
    const entries: UserDietaryEntry[] = [
      {
        id: "e1",
        label: "Vegetarian",
        notes: null,
        category: "requirement",
        shareWithAllGroups: false,
        shares: [],
      },
    ];
    expect(deriveDietarySharingScope(entries, groups).shareAllGroups).toBe(false);
  });

  it("fixes the multi-group count summary shape for partial group sharing", () => {
    const entries: UserDietaryEntry[] = [
      {
        id: "e1",
        label: "Vegetarian",
        notes: null,
        category: "requirement",
        shareWithAllGroups: false,
        shares: [{ groupId: "g1", groupName: "Friends" }],
      },
      {
        id: "e2",
        label: "Nut allergy",
        notes: null,
        category: "allergy",
        shareWithAllGroups: false,
        shares: [],
      },
    ];
    const scope = deriveDietarySharingScope(entries, groups);
    expect(scope.groups[0]?.partial).toBe(true);
    expect(scope.groups[0]?.enabled).toBe(false);
  });
});
