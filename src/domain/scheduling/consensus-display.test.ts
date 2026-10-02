import { describe, expect, it } from "vitest";

import {
  availabilityResponseOptions,
  buildAttendanceSummaryLines,
  candidateStatusBadge,
  consensusRuleRequirementSummary,
  eventSchedulingSectionMessage,
  hasNoResponsesYet,
  isCandidateOpenForResponses,
  proposalDeadlineGroupNotice,
  shouldShowFinaliseControl,
} from "./consensus-display";

describe("consensus display (HUI-017)", () => {
  const baseCounts = {
    acceptedCount: 4,
    maybeCount: 1,
    unavailableCount: 1,
    noResponseCount: 2,
    maybeResponsesEnabled: true,
  };

  it("builds aggregate attendance lines without identities", () => {
    expect(buildAttendanceSummaryLines(baseCounts)).toEqual([
      "4 available",
      "1 maybe",
      "1 unavailable",
      "2 haven't responded",
    ]);
  });

  it("omits maybe from attendance when disabled", () => {
    expect(
      buildAttendanceSummaryLines({ ...baseCounts, maybeResponsesEnabled: false }),
    ).toEqual(["4 available", "1 unavailable", "2 haven't responded"]);
  });

  it("describes consensus rules from server-provided counts only", () => {
    expect(
      consensusRuleRequirementSummary("minimum_attendees", {
        minimumAttendees: 4,
        eligibleMemberCount: 8,
        requiredParticipantCount: 0,
      }),
    ).toBe("Minimum required: 4");

    expect(
      consensusRuleRequirementSummary("all_active_members", {
        minimumAttendees: 3,
        eligibleMemberCount: 6,
        requiredParticipantCount: 0,
      }),
    ).toContain("6 members");

    expect(
      consensusRuleRequirementSummary("required_participants", {
        minimumAttendees: 2,
        eligibleMemberCount: 5,
        requiredParticipantCount: 0,
      }),
    ).toBe("Minimum required: 2");

    expect(
      consensusRuleRequirementSummary("required_participants", {
        minimumAttendees: 2,
        eligibleMemberCount: 5,
        requiredParticipantCount: 3,
      }),
    ).toContain("3 required");
  });

  it("lists response options and hides maybe when disabled", () => {
    expect(availabilityResponseOptions(true)).toEqual([
      "available",
      "maybe",
      "unavailable",
    ]);
    expect(availabilityResponseOptions(false)).toEqual(["available", "unavailable"]);
  });

  it("marks when a candidate is open for responses", () => {
    expect(isCandidateOpenForResponses("proposing", "proposed")).toBe(true);
    expect(isCandidateOpenForResponses("confirmed", "proposed")).toBe(false);
    expect(isCandidateOpenForResponses("proposing", "selected")).toBe(false);
    expect(isCandidateOpenForResponses("cancelled", "proposed")).toBe(false);
  });

  it("shows finalise only for authorised proposing events with passing candidates", () => {
    expect(
      shouldShowFinaliseControl(true, "proposing", "proposed", true),
    ).toBe(true);
    expect(
      shouldShowFinaliseControl(true, "proposing", "proposed", false),
    ).toBe(false);
    expect(
      shouldShowFinaliseControl(false, "proposing", "proposed", true),
    ).toBe(false);
    expect(
      shouldShowFinaliseControl(true, "confirmed", "selected", true),
    ).toBe(false);
  });

  it("labels candidate and event states", () => {
    expect(candidateStatusBadge("proposing", "proposed", false)).toBe(
      "Open for responses",
    );
    expect(candidateStatusBadge("proposing", "proposed", true)).toBe(
      "Meets requirements",
    );
    expect(candidateStatusBadge("confirmed", "selected", true)).toBe(
      "Confirmed time",
    );
    expect(candidateStatusBadge("confirmed", "proposed", false)).toBe(
      "Not selected",
    );
    expect(candidateStatusBadge("proposing", "withdrawn", false)).toBe(
      "Withdrawn",
    );
  });

  it("surfaces scheduling section messages for empty, passing, and terminal states", () => {
    expect(eventSchedulingSectionMessage("proposing", 0, false)).toContain(
      "No candidate meets",
    );
    expect(eventSchedulingSectionMessage("proposing", 2, true)).toContain(
      "locks candidate",
    );
    expect(eventSchedulingSectionMessage("confirmed", 0, false)).toContain(
      "locked",
    );
    expect(eventSchedulingSectionMessage("cancelled", 0, false)).toContain(
      "cancelled",
    );
  });

  it("detects awaiting-first-response state", () => {
    expect(
      hasNoResponsesYet({
        acceptedCount: 0,
        maybeCount: 0,
        unavailableCount: 0,
        noResponseCount: 5,
        maybeResponsesEnabled: true,
      }),
    ).toBe(true);
    expect(hasNoResponsesYet({ ...baseCounts, acceptedCount: 1 })).toBe(false);
  });

  it("describes proposal deadline without implying enforcement", () => {
    expect(proposalDeadlineGroupNotice(null)).toBeNull();
    expect(proposalDeadlineGroupNotice(48)).toContain("does not automatically close");
  });
});
