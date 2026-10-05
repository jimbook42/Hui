import { describe, expect, it } from "vitest";

import {
  attendanceStateFromChoice,
  classifyHomeEvent,
  compareSoonest,
  hasEventEnded,
  viewerStatusLabel,
  type HomeEventFacts,
} from "./home";

const NOW = new Date("2026-10-10T00:00:00Z");

function facts(overrides: Partial<HomeEventFacts>): HomeEventFacts {
  return {
    status: "proposing",
    startsAt: "2026-10-15T05:30:00Z",
    endsAt: "2026-10-15T08:00:00Z",
    viewerResponse: null,
    hasCandidate: true,
    hasPendingHostProposal: false,
    ...overrides,
  };
}

describe("classifyHomeEvent", () => {
  it("surfaces an unanswered proposal as needing a response", () => {
    expect(classifyHomeEvent(facts({}), NOW)).toEqual({ bucket: "attention", attention: "respond" });
  });

  it("moves answered proposals into planning", () => {
    expect(classifyHomeEvent(facts({ viewerResponse: "maybe" }), NOW)).toEqual({
      bucket: "planning",
      attention: null,
    });
  });

  it("does not ask for a response when there is no time on the table", () => {
    expect(classifyHomeEvent(facts({ hasCandidate: false }), NOW).bucket).toBe("planning");
  });

  it("surfaces a pending hosting proposal", () => {
    expect(
      classifyHomeEvent(facts({ viewerResponse: "available", hasPendingHostProposal: true }), NOW),
    ).toEqual({ bucket: "attention", attention: "host" });
  });

  it("prefers the attendance response over hosting when both are open", () => {
    expect(classifyHomeEvent(facts({ hasPendingHostProposal: true }), NOW).attention).toBe("respond");
  });

  it("treats confirmed future gatherings as upcoming", () => {
    expect(classifyHomeEvent(facts({ status: "confirmed", viewerResponse: "available" }), NOW)).toEqual({
      bucket: "upcoming",
      attention: null,
    });
  });

  it("surfaces hosting requests on confirmed gatherings", () => {
    expect(
      classifyHomeEvent(
        facts({ status: "confirmed", viewerResponse: "available", hasPendingHostProposal: true }),
        NOW,
      ).attention,
    ).toBe("host");
  });

  it("surfaces confirm when a proposer can lock a passing time", () => {
    expect(
      classifyHomeEvent(
        facts({ status: "proposing", viewerResponse: "available", canConfirmTime: true }),
        NOW,
      ),
    ).toEqual({ bucket: "attention", attention: "confirm" });
  });

  it("surfaces open contributions on confirmed gatherings", () => {
    expect(
      classifyHomeEvent(
        facts({
          status: "confirmed",
          viewerResponse: "available",
          unclaimedContributionCount: 2,
        }),
        NOW,
      ),
    ).toEqual({ bucket: "attention", attention: "contribute" });
  });

  it("does not nudge contributions when the viewer already claimed something", () => {
    expect(
      classifyHomeEvent(
        facts({
          status: "confirmed",
          viewerResponse: "available",
          unclaimedContributionCount: 2,
          viewerHasContribution: true,
        }),
        NOW,
      ),
    ).toEqual({ bucket: "upcoming", attention: null });
  });

  it("sends finished and cancelled gatherings to the past", () => {
    expect(
      classifyHomeEvent(
        facts({ status: "confirmed", startsAt: "2026-10-01T05:00:00Z", endsAt: "2026-10-01T08:00:00Z" }),
        NOW,
      ).bucket,
    ).toBe("past");
    expect(classifyHomeEvent(facts({ status: "cancelled" }), NOW).bucket).toBe("past");
    expect(classifyHomeEvent(facts({ status: "completed" }), NOW).bucket).toBe("past");
  });
});

describe("hasEventEnded", () => {
  it("uses a default duration when no end is set", () => {
    expect(hasEventEnded("2026-10-09T23:00:00Z", null, NOW)).toBe(false);
    expect(hasEventEnded("2026-10-09T20:00:00Z", null, NOW)).toBe(true);
  });

  it("is false without any time", () => {
    expect(hasEventEnded(null, null, NOW)).toBe(false);
  });
});

describe("attendance helpers", () => {
  it("maps responses to visual states", () => {
    expect(attendanceStateFromChoice("available")).toBe("yes");
    expect(attendanceStateFromChoice("maybe")).toBe("maybe");
    expect(attendanceStateFromChoice("maybe", false)).toBe("pending");
    expect(attendanceStateFromChoice("unavailable")).toBe("no");
    expect(attendanceStateFromChoice(null)).toBe("pending");
  });

  it("labels the viewer's status in Hui vocabulary", () => {
    expect(viewerStatusLabel("yes")).toBe("You're in");
    expect(viewerStatusLabel("pending")).toBe("Needs your answer");
  });
});

describe("compareSoonest", () => {
  it("orders by time and sinks undated gatherings", () => {
    const items = [
      { id: "none", startsAt: null },
      { id: "later", startsAt: "2026-11-01T00:00:00Z" },
      { id: "soon", startsAt: "2026-10-12T00:00:00Z" },
    ];
    expect(items.sort(compareSoonest).map((item) => item.id)).toEqual(["soon", "later", "none"]);
  });
});
