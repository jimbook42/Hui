import { describe, expect, it } from "vitest";

import { buildContributionBoard, buildContributionHistory } from "./display";

describe("contribution display", () => {
  it("partitions still needed and claimed categories", () => {
    const categories = [
      {
        id: "c1",
        groupId: "g",
        name: "Main",
        archivedAt: null,
        followsHost: false,
        defaultAssigneeUserId: null,
      },
      {
        id: "c2",
        groupId: "g",
        name: "Dessert",
        archivedAt: null,
        followsHost: false,
        defaultAssigneeUserId: null,
      },
    ];
    const contributions = [
      {
        id: "x1",
        eventId: "e",
        groupId: "g",
        categoryId: "c2",
        categoryName: "Dessert",
        userId: "u1",
        label: "Cake",
        status: "accepted",
        displayName: "Isaac",
      },
    ];

    const board = buildContributionBoard(categories, contributions, "u2");
    expect(board.stillNeeded.map((c) => c.name)).toEqual(["Main"]);
    expect(board.claimed).toHaveLength(1);
    expect(board.mine).toHaveLength(0);
  });

  it("aggregates contribution history counts", () => {
    const entries = buildContributionHistory([
      { userId: "a", displayName: "Alice" },
      { userId: "a", displayName: "Alice" },
      { userId: "b", displayName: "Bob" },
    ]);
    expect(entries).toEqual([
      { userId: "a", displayName: "Alice", count: 2 },
      { userId: "b", displayName: "Bob", count: 1 },
    ]);
  });
});
