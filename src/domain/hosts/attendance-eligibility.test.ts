import { describe, expect, it } from "vitest";

import { filterHostAssignableMembers } from "./attendance-eligibility";

describe("host attendance eligibility (HUI-022A.2)", () => {
  const members = [
    { userId: "a", displayName: "Alice", hostingStanding: "default" as const },
    { userId: "b", displayName: "Bob", hostingStanding: "prefer_not" as const },
    { userId: "c", displayName: "Cara", hostingStanding: "never" as const },
  ];

  it("includes only members who responded yes or maybe", () => {
    const roster = {
      maybeResponsesEnabled: true,
      members: [
        { userId: "a", displayName: "Alice", response: "yes" as const },
        { userId: "b", displayName: "Bob", response: "maybe" as const },
        { userId: "c", displayName: "Cara", response: null },
        { userId: "d", displayName: "Dan", response: "no" as const },
      ],
    };

    const result = filterHostAssignableMembers(
      [...members, { userId: "d", displayName: "Dan", hostingStanding: "default" }],
      roster,
    );
    expect(result.map((m) => m.userId).sort()).toEqual(["a", "b"]);
  });

  it("excludes never-host members even when attending", () => {
    const roster = {
      maybeResponsesEnabled: true,
      members: [{ userId: "c", displayName: "Cara", response: "yes" as const }],
    };
    expect(filterHostAssignableMembers(members, roster).map((m) => m.userId)).toEqual([]);
  });
});
