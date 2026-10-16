import { describe, expect, it } from "vitest";

import {
  confirmedEventConsensusPassesForDisplay,
  formatConfirmedHeroStatusLine,
  formatConfirmedReasonLine,
  formatEventStatusPillLabel,
  isConfirmedEventReasking,
  REASKING_STATUS_PILL_LABEL,
} from "./confirmed-because";

describe("formatConfirmedReasonLine", () => {
  it("uses majority wording for majority-rule groups", () => {
    expect(formatConfirmedReasonLine("majority_active_members")).toBe("Confirmed by majority");
  });

  it("uses admin wording when an admin picked the time", () => {
    expect(formatConfirmedReasonLine("majority_active_members", "admin")).toBe(
      "Confirmed by admin",
    );
  });

  it("covers other consensus rules briefly", () => {
    expect(formatConfirmedReasonLine("all_active_members")).toBe(
      "Confirmed · everyone can come",
    );
    expect(
      formatConfirmedReasonLine("majority_active_members", null, "when_everyone_can_come"),
    ).toBe("Confirmed · everyone can come");
    expect(
      formatConfirmedReasonLine("majority_active_members", null, "when_most_can_come"),
    ).toBe("Confirmed by majority");
    expect(formatConfirmedReasonLine("required_participants")).toBe(
      "Confirmed by required members",
    );
    expect(formatConfirmedReasonLine("minimum_attendees")).toBe("Confirmed");
  });
});

describe("formatConfirmedHeroStatusLine", () => {
  it("appends live attendance tallies", () => {
    expect(
      formatConfirmedHeroStatusLine({
        consensusRule: "majority_active_members",
        counts: { yes: 3, maybe: 0, pending: 1, no: 0, total: 4 },
        maybeResponsesEnabled: true,
      }),
    ).toBe("Confirmed by majority · 3 coming · 1 yet to answer");
  });

  it("uses organiser wording when force-confirmed", () => {
    expect(
      formatConfirmedHeroStatusLine({
        consensusRule: "majority_active_members",
        counts: { yes: 2, maybe: 0, pending: 0, no: 0, total: 2 },
        maybeResponsesEnabled: true,
        confirmationMethod: "organiser",
      }),
    ).toBe("Confirmed by organiser · 2 coming");
  });

  it("shows awaiting answers when confirmed but nobody has said yes yet", () => {
    expect(
      formatConfirmedHeroStatusLine({
        consensusRule: "majority_active_members",
        counts: { yes: 0, maybe: 0, pending: 4, no: 0, total: 4 },
        maybeResponsesEnabled: true,
      }),
    ).toBe("Confirmed by majority · Awaiting answers");
  });

  it("shows re-asking copy after reschedule until consensus passes again", () => {
    expect(
      formatConfirmedHeroStatusLine({
        consensusRule: "majority_active_members",
        counts: { yes: 0, maybe: 0, pending: 4, no: 0, total: 4 },
        maybeResponsesEnabled: true,
        consensusCurrentlyPasses: false,
      }),
    ).toBe("New time proposed · everyone is being asked again · Awaiting answers");
    expect(
      formatConfirmedHeroStatusLine({
        consensusRule: "majority_active_members",
        counts: { yes: 2, maybe: 0, pending: 1, no: 0, total: 3 },
        maybeResponsesEnabled: true,
        consensusCurrentlyPasses: true,
      }),
    ).toBe("Confirmed by majority · 2 coming · 1 yet to answer");
  });
});

describe("confirmedEventConsensusPassesForDisplay", () => {
  it("treats organiser-confirmed hui as not re-asking when consensus still fails", () => {
    expect(confirmedEventConsensusPassesForDisplay(false, "organiser")).toBe(true);
    expect(
      formatConfirmedHeroStatusLine({
        consensusRule: "majority_active_members",
        counts: { yes: 1, maybe: 0, pending: 3, no: 0, total: 4 },
        maybeResponsesEnabled: true,
        confirmationMethod: "organiser",
        consensusCurrentlyPasses: confirmedEventConsensusPassesForDisplay(false, "organiser"),
      }),
    ).toContain("Confirmed by organiser");
  });
});

describe("formatEventStatusPillLabel", () => {
  it("shows re-asking on confirmed hui until consensus passes again", () => {
    expect(isConfirmedEventReasking("confirmed", false)).toBe(true);
    expect(formatEventStatusPillLabel("confirmed", false)).toBe(REASKING_STATUS_PILL_LABEL);
    expect(formatEventStatusPillLabel("confirmed", true)).toBe("Confirmed");
    expect(formatEventStatusPillLabel("proposing", false)).toBe("Picking a time");
  });
});
