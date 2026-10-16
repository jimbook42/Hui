import { describe, expect, it } from "vitest";

import { inviteHeadline, inviteSupportingLines } from "./presentation";

const basePlanning = {
  eventId: "e1",
  eventTitle: "Dinner",
  status: "proposing",
  planningTargetDate: null as string | null,
  proposedStartsAt: null as string | null,
  gathering: {
    type: "dinner_meal" as const,
    customDescription: null,
    eventTitle: "Dinner",
  },
};

describe("invite presentation (HUI-ONBOARDING-002)", () => {
  it("builds natural planning copy with inviter, group, type, and title", () => {
    const headline = inviteHeadline({
      groupName: "Smith Family",
      inviterDisplayName: "Isaac",
      planning: {
        ...basePlanning,
        eventTitle: "Mum's birthday",
        gathering: {
          type: "dinner_meal",
          customDescription: null,
          eventTitle: "Mum's birthday",
        },
      },
    });
    expect(headline).toBe(
      "Isaac invited you to help plan Mum's birthday dinner with Smith Family.",
    );
  });

  it("lists group, hui, and planning target in supporting copy", () => {
    const lines = inviteSupportingLines({
      groupName: "Smith Family",
      inviterDisplayName: null,
      planning: {
        ...basePlanning,
        planningTargetDate: "2026-10-11",
      },
      timeZone: "Pacific/Auckland",
    });
    expect(lines[0]).toBe("Group: Smith Family");
    expect(lines[1]).toBe("Hui: Dinner");
    expect(lines[2]).toBe(
      "Planning for around 11 October — not a confirmed date yet.",
    );
  });

  it("prefers proposed candidate time over planning target for invite dates", () => {
    const lines = inviteSupportingLines({
      groupName: "QA Group",
      inviterDisplayName: null,
      planning: {
        ...basePlanning,
        eventTitle: "October dinner",
        planningTargetDate: "2026-10-14",
        proposedStartsAt: "2026-10-24T08:30:00.000Z",
        gathering: {
          type: "dinner_meal",
          customDescription: null,
          eventTitle: "October dinner",
        },
      },
      timeZone: "Pacific/Auckland",
    });
    expect(lines[2]).toMatch(/24 Oct/);
    expect(lines[2]).not.toMatch(/14 Oct/);
  });

  it("does not shift planning target dates forward in NZ time zones", () => {
    const november = inviteSupportingLines({
      groupName: "QA Group",
      inviterDisplayName: null,
      planning: {
        ...basePlanning,
        planningTargetDate: "2026-11-02",
      },
      timeZone: "Pacific/Auckland",
    });
    expect(november[2]).toContain("2 November");

    const second = inviteSupportingLines({
      groupName: "QA Group",
      inviterDisplayName: null,
      planning: {
        ...basePlanning,
        eventTitle: "Lunch",
        planningTargetDate: "2026-11-09",
        gathering: {
          type: "dinner_meal",
          customDescription: null,
          eventTitle: "Lunch",
        },
      },
      timeZone: "Pacific/Auckland",
    });
    expect(second[2]).toContain("9 November");
  });

  it("avoids Former member in planning invite headline", () => {
    const headline = inviteHeadline({
      groupName: "Smith Family",
      inviterDisplayName: "Former member",
      planning: basePlanning,
    });
    expect(headline).toBe("You were invited to help plan Dinner with Smith Family.");
    expect(headline).not.toMatch(/Former member invited/i);
  });

  it("avoids inventing a confirmed gathering date when only type is known", () => {
    const headline = inviteHeadline({
      groupName: "Smith Family",
      inviterDisplayName: "Isaac",
      planning: {
        ...basePlanning,
        eventTitle: "Friday thing",
        planningTargetDate: "2026-10-09",
        gathering: {
          type: "dinner_meal",
          customDescription: null,
          eventTitle: "Friday thing",
        },
      },
    });
    expect(headline).not.toMatch(/October/);
    expect(headline).not.toMatch(/Next dinner/i);
  });
});
