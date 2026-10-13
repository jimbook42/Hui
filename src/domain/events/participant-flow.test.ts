import { describe, expect, it } from "vitest";

import {
  canSuggestAlternativeTimeInFlow,
  canUseParticipantRespondFlow,
  nextStepAfterAttendanceSave,
  participantAttendanceBranch,
  pickParticipantTimeCandidate,
} from "./participant-flow";

describe("participant flow (HUI-026B)", () => {
  const candidate = {
    id: "c1",
    startsAt: "2026-11-01T18:00:00Z",
    endsAt: "2026-11-01T20:00:00Z",
    status: "proposed" as const,
    viewerResponse: null,
  };

  it("prefers selected candidate over proposed times", () => {
    const picked = pickParticipantTimeCandidate([
      candidate,
      {
        ...candidate,
        id: "c2",
        status: "selected",
      },
    ]);
    expect(picked?.id).toBe("c2");
  });

  it("branches yes/maybe vs no after attendance", () => {
    expect(participantAttendanceBranch("available")).toBe("yes-maybe");
    expect(participantAttendanceBranch("maybe")).toBe("yes-maybe");
    expect(participantAttendanceBranch("unavailable")).toBe("no");
    expect(nextStepAfterAttendanceSave("available")).toBe("place");
    expect(nextStepAfterAttendanceSave("unavailable")).toBe("declined");
  });

  it("is open while proposing or confirmed (HUI-026U.3) and needs a candidate", () => {
    expect(
      canUseParticipantRespondFlow({ eventStatus: "proposing", hasCandidate: true }),
    ).toBe(true);
    expect(
      canUseParticipantRespondFlow({ eventStatus: "confirmed", hasCandidate: true }),
    ).toBe(true);
    expect(
      canUseParticipantRespondFlow({ eventStatus: "proposing", hasCandidate: false }),
    ).toBe(false);
    expect(
      canUseParticipantRespondFlow({ eventStatus: "completed", hasCandidate: true }),
    ).toBe(false);
    expect(
      canUseParticipantRespondFlow({ eventStatus: "cancelled", hasCandidate: true }),
    ).toBe(false);
  });

  it("allows alternative-time suggestions when members may propose", () => {
    expect(
      canSuggestAlternativeTimeInFlow("member", { whoMayPropose: "any_member" } as never, "proposing"),
    ).toBe(true);
    expect(
      canSuggestAlternativeTimeInFlow("member", { whoMayPropose: "admins_only" } as never, "proposing"),
    ).toBe(false);
  });
});
