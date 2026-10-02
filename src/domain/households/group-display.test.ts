import { describe, expect, it } from "vitest";

import { buildGroupMembersHouseholdView } from "./group-display";

describe("buildGroupMembersHouseholdView", () => {
  it("groups active members under household names and lists ungrouped members", () => {
    const members = [
      {
        userId: "u1",
        displayName: "Isaac",
        role: "owner" as const,
        joinedAt: "",
        consensusRequired: false,
        hostingStanding: "default" as const,
      },
      {
        userId: "u2",
        displayName: "Alice",
        role: "member" as const,
        joinedAt: "",
        consensusRequired: false,
        hostingStanding: "default" as const,
      },
      {
        userId: "u3",
        displayName: "Sam",
        role: "member" as const,
        joinedAt: "",
        consensusRequired: false,
        hostingStanding: "default" as const,
      },
    ];

    const view = buildGroupMembersHouseholdView(
      members,
      [{ id: "h1", name: "Tull household" }],
      [
        { householdId: "h1", userId: "u1", displayName: "Isaac" },
        { householdId: "h1", userId: "u2", displayName: "Alice" },
      ],
    );

    expect(view.households).toHaveLength(1);
    expect(view.households[0].householdName).toBe("Tull household");
    expect(view.households[0].members.map((m) => m.displayName)).toEqual([
      "Alice",
      "Isaac",
    ]);
    expect(view.ungroupedMembers).toEqual([{ userId: "u3", displayName: "Sam" }]);
  });
});
