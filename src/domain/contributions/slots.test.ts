import { describe, expect, it } from "vitest";

import { buildContributionSlots, isContributionSlotFilled, sortContributionSlotsForDisplay } from "./slots";

const baseCategory = {
  groupId: "g",
  archivedAt: null,
  followsHost: false,
  defaultAssigneeUserId: null,
};

describe("contribution slots", () => {
  it("treats open rows with an assignee as filled", () => {
    const contribution = {
      id: "c1",
      eventId: "e",
      groupId: "g",
      categoryId: "main",
      categoryName: "Main",
      userId: "host",
      label: "Main",
      status: "open",
      displayName: "Host",
      assignedByUserId: "host",
      assignedByDisplayName: "Host",
    };
    expect(isContributionSlotFilled(contribution)).toBe(true);
  });

  it("labels host-bound contributions for the accepted host", () => {
    const slots = buildContributionSlots(
      [
        { id: "main", name: "Main", ...baseCategory, followsHost: true },
      ],
      [
        {
          id: "ec1",
          eventId: "e",
          groupId: "g",
          categoryId: "main",
          categoryName: "Main",
          userId: "host",
          label: "Main",
          status: "accepted",
          displayName: "Jamie",
          assignedByUserId: "owner",
          assignedByDisplayName: "Owner",
        },
      ],
      "viewer",
      "host",
    );
    expect(slots[0]?.state).toBe("host");
    expect(slots[0]?.statusLabel).toContain("Host is bringing");
  });

  it("shows manager assignment copy for other members", () => {
    const slots = buildContributionSlots(
      [{ id: "dessert", name: "Dessert", ...baseCategory }],
      [
        {
          id: "ec2",
          eventId: "e",
          groupId: "g",
          categoryId: "dessert",
          categoryName: "Dessert",
          userId: "member",
          label: "Dessert",
          status: "accepted",
          displayName: "Mia",
          assignedByUserId: "owner",
          assignedByDisplayName: "Olivia",
        },
      ],
      "viewer",
      null,
    );
    expect(slots[0]?.state).toBe("assigned");
    expect(slots[0]?.statusLabel).toMatch(/Assigned to Mia/);
  });

  it("lists unclaimed slots before claimed ones", () => {
    const sorted = sortContributionSlotsForDisplay(
      buildContributionSlots(
        [
          { id: "main", name: "Main", ...baseCategory },
          { id: "dessert", name: "Dessert", ...baseCategory },
        ],
        [
          {
            id: "ec1",
            eventId: "e",
            groupId: "g",
            categoryId: "main",
            categoryName: "Main",
            userId: "u1",
            label: "Main",
            status: "accepted",
            displayName: "Alex",
            assignedByUserId: "u1",
            assignedByDisplayName: "Alex",
          },
        ],
        "viewer",
        null,
      ),
    );
    expect(sorted.map((slot) => slot.category.name)).toEqual(["Dessert", "Main"]);
  });
});
