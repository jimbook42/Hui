import { describe, expect, it } from "vitest";

import type { ContributionSlot } from "@/domain/contributions/slots";
import { buildContributionSlots } from "@/domain/contributions/slots";

import {
  bestViewerResponseAcrossProposedCandidates,
  canSuggestAlternativeTimeInFlow,
  canUseParticipantRespondFlow,
  nextStepAfterAttendanceSave,
  nextStepAfterPlace,
  participantAttendanceBranch,
  participantFlowStepsForBack,
  pickParticipantTimeCandidate,
  multiTimeProposingAnswerPresentation,
  respondAttendanceCandidates,
  shouldShowParticipantBringStep,
  viewerResponseForDisplay,
} from "./participant-flow";

describe("participant flow (HUI-026B)", () => {
  const candidate = {
    id: "c1",
    startsAt: "2026-11-01T18:00:00Z",
    endsAt: "2026-11-01T20:00:00Z",
    status: "proposed" as const,
    viewerResponse: null,
  };

  it("picks the best viewer answer across proposed times", () => {
    const second = { ...candidate, id: "c2" };
    expect(
      bestViewerResponseAcrossProposedCandidates([
        { ...candidate, viewerResponse: "maybe" },
        { ...second, viewerResponse: "available" },
      ]),
    ).toBe("available");
    expect(
      bestViewerResponseAcrossProposedCandidates([
        { ...candidate, viewerResponse: "unavailable" },
        { ...second, viewerResponse: "maybe" },
      ]),
    ).toBe("maybe");
    expect(
      bestViewerResponseAcrossProposedCandidates([
        { ...candidate, viewerResponse: "unavailable" },
        { ...second, viewerResponse: "unavailable" },
      ]),
    ).toBe("unavailable");
    expect(
      bestViewerResponseAcrossProposedCandidates([
        { ...candidate, viewerResponse: "unavailable" },
        second,
      ]),
    ).toBeNull();
  });

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

  it("uses the selected candidate answer when the hui is confirmed", () => {
    expect(
      viewerResponseForDisplay(
        [
          { ...candidate, viewerResponse: "maybe" },
          {
            ...candidate,
            id: "c2",
            status: "selected",
            viewerResponse: "available",
          },
        ],
        "confirmed",
      ),
    ).toBe("available");
  });

  it("summarises multi-time answers without treating one yes as yes to all times", () => {
    const presentation = multiTimeProposingAnswerPresentation(
      [
        { ...candidate, viewerResponse: "maybe" },
        { ...candidate, id: "c2", viewerResponse: "available" },
      ],
      "proposing",
    );
    expect(presentation?.summaryLabel).toBe("Yes to 1 of 2 times");
    expect(presentation?.showPlaceFollowUp).toBe(false);
    expect(presentation?.statusChoice).toBeNull();
  });

  it("lists only the selected time on the respond flow after confirmation", () => {
    const rows = respondAttendanceCandidates(
      [
        { ...candidate, viewerResponse: "maybe" },
        {
          ...candidate,
          id: "c2",
          status: "selected",
          viewerResponse: "available",
        },
      ],
      "confirmed",
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBe("c2");
  });

  it("branches yes/maybe vs no after attendance", () => {
    expect(participantAttendanceBranch("available")).toBe("yes-maybe");
    expect(participantAttendanceBranch("maybe")).toBe("yes-maybe");
    expect(participantAttendanceBranch("unavailable")).toBe("no");
    expect(nextStepAfterAttendanceSave("available")).toBe("place");
    expect(nextStepAfterAttendanceSave("unavailable")).toBe("declined");
    expect(nextStepAfterAttendanceSave("available", { showPlaceStep: false })).toBe("done");
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

  it("skips the bring step when nothing is needed and the viewer has no claim", () => {
    const baseCategory = {
      groupId: "g",
      archivedAt: null,
      followsHost: false,
      defaultAssigneeUserId: null,
    };
    const filled = buildContributionSlots(
      [{ id: "dessert", name: "Dessert", ...baseCategory }],
      [
        {
          id: "ec1",
          eventId: "e",
          groupId: "g",
          categoryId: "dessert",
          categoryName: "Dessert",
          userId: "other",
          label: "Cake",
          status: "accepted",
          displayName: "Mia",
          assignedByUserId: null,
          assignedByDisplayName: null,
        },
      ],
      "viewer",
      null,
    );
    expect(shouldShowParticipantBringStep(filled)).toBe(false);
    expect(nextStepAfterPlace(false)).toBe("done");
    expect(participantFlowStepsForBack("done", { showBringStep: false })).toBe("place");
  });

  it("shows the bring step when a slot is open or the viewer already claimed", () => {
    const baseCategory = {
      groupId: "g",
      archivedAt: null,
      followsHost: false,
      defaultAssigneeUserId: null,
    };
    const openSlot = buildContributionSlots(
      [{ id: "dessert", name: "Dessert", ...baseCategory }],
      [
        {
          id: "ec1",
          eventId: "e",
          groupId: "g",
          categoryId: "dessert",
          categoryName: "Dessert",
          userId: null,
          label: "Dessert",
          status: "open",
          displayName: null,
          assignedByUserId: null,
          assignedByDisplayName: null,
        },
      ],
      "viewer",
      null,
    );
    expect(shouldShowParticipantBringStep(openSlot)).toBe(true);

    const mine = buildContributionSlots(
      [{ id: "dessert", name: "Dessert", ...baseCategory }],
      [
        {
          id: "ec2",
          eventId: "e",
          groupId: "g",
          categoryId: "dessert",
          categoryName: "Dessert",
          userId: "viewer",
          label: "Cake",
          status: "accepted",
          displayName: "You",
          assignedByUserId: null,
          assignedByDisplayName: null,
        },
      ],
      "viewer",
      null,
    );
    expect(shouldShowParticipantBringStep(mine)).toBe(true);
    expect(shouldShowParticipantBringStep([] as ContributionSlot[])).toBe(false);
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
