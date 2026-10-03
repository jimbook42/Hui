import { describe, expect, it } from "vitest";

import { pickPendingHostProposal } from "@/domain/hosts/display";
import { canRequestHostSwap, canRespondToHostProposal } from "@/domain/hosts/permissions";
import type { HostAssignmentSnapshot } from "@/domain/hosts/types";

import { buildEventHostView } from "./queries";

/** Mirrors EventHostSection + event page host gating for regression tests. */
function hostUiState(
  assignments: HostAssignmentSnapshot[],
  viewerId: string,
  eventStatus: "proposing" | "confirmed" = "proposing",
) {
  const view = buildEventHostView(assignments);
  const pending = pickPendingHostProposal(assignments);
  const suggestedName = view.pendingProposal?.displayName ?? null;
  const canRespond = canRespondToHostProposal(viewerId, pending, eventStatus);
  const canRequestSwap = canRequestHostSwap(viewerId, assignments, eventStatus);
  const acceptedUserId = view.acceptedHost?.userId ?? null;
  const showAcceptedSwap =
    Boolean(view.acceptedHost) &&
    canRequestSwap &&
    acceptedUserId === viewerId;
  const showProposedSwap = Boolean(suggestedName) && canRequestSwap;
  return {
    suggestedName,
    canRespond,
    canRequestSwap,
    showAcceptedSwap,
    showProposedSwap,
    pendingUserId: pending?.userId ?? null,
    acceptedUserId,
  };
}

describe("event host view (HUI-022A.2 audit)", () => {
  it("shows no suggested host when there are zero persisted assignments", () => {
    const state = hostUiState([], "viewer-1");
    expect(state.suggestedName).toBeNull();
    expect(state.canRespond).toBe(false);
    expect(buildEventHostView([]).suggestion).toBeNull();
  });

  it("shows suggested host only from a persisted proposed assignment", () => {
    const assignments: HostAssignmentSnapshot[] = [
      {
        id: "ha-1",
        eventId: "ev-1",
        userId: "isaac",
        status: "proposed",
        displayName: "Isaac First",
        createdAt: "2026-01-01T00:00:00Z",
      },
    ];
    const viewer = hostUiState(assignments, "isaac");
    const other = hostUiState(assignments, "jamie");

    expect(viewer.suggestedName).toBe("Isaac First");
    expect(viewer.canRespond).toBe(true);
    expect(other.suggestedName).toBe("Isaac First");
    expect(other.canRespond).toBe(false);
    expect(buildEventHostView(assignments).suggestion).toBeNull();
    expect(viewer.showProposedSwap).toBe(true);
    expect(other.showProposedSwap).toBe(false);
  });

  it("shows swap for accepted host viewer while proposing", () => {
    const assignments: HostAssignmentSnapshot[] = [
      {
        id: "ha-1",
        eventId: "ev-1",
        userId: "isaac",
        status: "accepted",
        displayName: "Isaac First",
        createdAt: "2026-01-01T00:00:00Z",
      },
    ];
    const isaac = hostUiState(assignments, "isaac");
    const jamie = hostUiState(assignments, "jamie");

    expect(isaac.acceptedUserId).toBe("isaac");
    expect(isaac.showAcceptedSwap).toBe(true);
    expect(isaac.canRespond).toBe(false);
    expect(jamie.showAcceptedSwap).toBe(false);
    expect(jamie.canRequestSwap).toBe(false);
  });
});
