import { describe, expect, it } from "vitest";

import { inviteHeadline, inviteSupportingLines } from "./presentation";

describe("invite presentation (HUI-ONBOARDING-002)", () => {
  it("builds natural planning copy with inviter, group, type, and title", () => {
    const headline = inviteHeadline({
      groupName: "Smith Family",
      inviterDisplayName: "Isaac",
      planning: {
        eventId: "e1",
        eventTitle: "Mum's birthday",
        status: "proposing",
        planningTargetDate: null,
        gathering: {
          type: "dinner_meal",
          customDescription: null,
          eventTitle: "Mum's birthday",
        },
      },
    });
    expect(headline).toBe(
      "Isaac invited you to join Smith Family for planning Mum's birthday dinner.",
    );
  });

  it("does not treat planning target as a confirmed date in supporting copy", () => {
    const lines = inviteSupportingLines({
      groupName: "Smith Family",
      inviterDisplayName: null,
      planning: {
        eventId: "e1",
        eventTitle: "Dinner",
        status: "proposing",
        planningTargetDate: "2026-10-11",
        gathering: {
          type: "dinner_meal",
          customDescription: null,
          eventTitle: "Dinner",
        },
      },
      timeZone: "Pacific/Auckland",
    });
    expect(lines[0]).toMatch(/Planning for around/);
    expect(lines[0]).toMatch(/not a confirmed date/i);
  });

  it("avoids inventing a confirmed gathering date when only type is known", () => {
    const headline = inviteHeadline({
      groupName: "Smith Family",
      inviterDisplayName: "Isaac",
      planning: {
        eventId: "e1",
        eventTitle: "Friday thing",
        status: "proposing",
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
