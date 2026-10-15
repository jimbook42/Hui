import "@testing-library/jest-dom/vitest";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { EventParticipantRespondFlow } from "@/components/events/event-participant-respond-flow";
import type { EventCandidateRow } from "@/lib/scheduling/types";

vi.mock("@/app/events/scheduling-actions", () => ({
  setAvailabilityResponseAction: vi.fn(),
  addCandidateAction: vi.fn(),
}));

vi.mock("@/app/contributions/actions", () => ({
  claimContributionAction: vi.fn(),
}));

vi.mock("@/components/hui/event-location-panel", () => ({
  EventPlaceMap: () => null,
}));

vi.mock("@/components/events/wall-clock-picker-field", () => ({
  WallClockDateField: () => null,
  WallClockTimeField: () => null,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@/components/events/event-lifecycle-live-refresh", () => ({
  EventLifecycleLiveRefresh: () => null,
}));

function buildCandidate(id: string, startsAt: string): EventCandidateRow {
  return {
    id,
    startsAt,
    endsAt: null,
    status: "proposed",
    proposedBy: "owner",
    createdAt: startsAt,
    viewerResponse: null,
    viewerPrivateNote: null,
  };
}

describe("EventParticipantRespondFlow SSR", () => {
  it("renders multi-time heading on the server without throwing", () => {
    const a = buildCandidate("cand-a", "2026-10-22T06:00:00.000Z");
    const b = buildCandidate("cand-b", "2026-10-24T05:30:00.000Z");
    const c = buildCandidate("cand-c", "2026-10-29T06:00:00.000Z");
    const labels = {
      "cand-a": "Thu 22 Oct, 7:00pm",
      "cand-b": "Sat 24 Oct, 6:30pm",
      "cand-c": "Thu 29 Oct, 7:00pm",
    };

    const html = renderToString(
      <EventParticipantRespondFlow
        eventId="event-1"
        groupId="group-1"
        eventTitle="Board-game night"
        groupName="Fortnightly Board-Game Night"
        timeZone="Pacific/Auckland"
        maybeResponsesEnabled={true}
        canRespond={true}
        canCoordinateContributions={false}
        canSuggestTime={false}
        candidate={a}
        proposedCandidates={[a, b, c]}
        placeView={{ kind: "pending", line: "Place still being worked out" }}
        coordinates={null}
        hostingEnabled={true}
        viewerUserId="user-i2"
        initialViewerResponse={null}
        standingAvailabilityHint={null}
        focusTimeLabel="Thu 22 Oct, 7:00pm"
        candidateTimeLabels={labels}
        replyByLabel={null}
        eventStatus="proposing"
      />,
    );

    expect(html).toContain("Can you make it?");
  });
});
