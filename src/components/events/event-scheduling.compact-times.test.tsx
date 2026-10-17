import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { EventScheduling } from "@/components/events/event-scheduling";
import type { EventCandidateRow } from "@/lib/scheduling/types";

vi.mock("@/app/events/scheduling-actions", () => ({
  addCandidateAction: vi.fn(),
  finaliseEventAction: vi.fn(),
  setAvailabilityResponseAction: vi.fn(),
  withdrawCandidateAction: vi.fn(),
}));

vi.mock("@/components/auth/auth-form", () => ({
  AuthForm: ({ children }: { children: React.ReactNode }) => <form>{children}</form>,
  AuthField: () => null,
}));

vi.mock("@/components/hui/gathering-visual", () => ({
  GatheringVisual: () => <div data-testid="gathering-visual" />,
}));
vi.mock("@/components/hosts/host-swap-request-form", () => ({
  HostSwapRequestForm: () => <div data-testid="host-swap-form" />,
}));
vi.mock("@/components/hosts/accept-host-with-place-form", () => ({
  AcceptHostWithPlaceForm: () => <div data-testid="accept-host-form" />,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
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

describe("EventScheduling compact per-time list", () => {
  it("shows can and can't counts on each row and expands to attendance names", async () => {
    const user = userEvent.setup();
    const a = buildCandidate("a", "2026-10-20T10:00:00.000Z");
    const b = buildCandidate("b", "2026-10-21T10:00:00.000Z");

    render(
      <EventScheduling
        eventId="event-1"
        groupId="group-1"
        eventStatus="proposing"
        candidates={[a, b]}
        withdrawnCandidates={[]}
        maybeResponsesEnabled={false}
        minimumAttendees={2}
        proposalDeadlineHours={null}
        replyByLabel={null}
        consensus={{
          confirmRule: "when_most_can_come",
          consensusRule: "majority_active_members",
          minimumAttendees: 2,
          eligibleMemberCount: 4,
          maybeResponsesEnabled: false,
          candidates: [
            {
              candidateId: "a",
              startsAt: a.startsAt,
              endsAt: null,
              passes: false,
              yesCount: 2,
              maybeCount: 0,
              unavailableCount: 1,
              noResponseCount: 1,
              acceptedCount: 2,
              minimumAttendees: 2,
              eligibleMemberCount: 4,
              failureReason: null,
              consensusRule: "majority_active_members",
              requiredParticipantCount: 0,
              requiredAcceptedCount: 0,
              maybeResponsesEnabled: false,
            },
            {
              candidateId: "b",
              startsAt: b.startsAt,
              endsAt: null,
              passes: false,
              yesCount: 1,
              maybeCount: 0,
              unavailableCount: 0,
              noResponseCount: 3,
              acceptedCount: 1,
              minimumAttendees: 2,
              eligibleMemberCount: 4,
              failureReason: null,
              consensusRule: "majority_active_members",
              requiredParticipantCount: 0,
              requiredAcceptedCount: 0,
              maybeResponsesEnabled: false,
            },
          ],
        }}
        canAddCandidates={false}
        canRemoveCandidates={false}
        canRespond={false}
        canFinalise={false}
        timeZone="Pacific/Auckland"
        candidateTimeLabels={{ a: "Mon 20 Oct", b: "Tue 21 Oct" }}
        attendanceRosters={{
          a: {
            maybeResponsesEnabled: false,
            members: [
              { userId: "u1", displayName: "Alex", response: "yes", submittedLate: false },
              { userId: "u2", displayName: "Ben", response: "no", submittedLate: false },
            ],
          },
          b: { maybeResponsesEnabled: false, members: [] },
        }}
      />,
    );

    expect(screen.getByText("2 can · 1 can't")).toBeInTheDocument();
    expect(screen.getByText("1 can · 0 can't")).toBeInTheDocument();
    expect(screen.queryByTestId("gathering-visual")).toBeNull();

    expect(await screen.findByText("Alex")).toBeInTheDocument();
    expect(screen.getByText("Ben")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Tue 21 Oct/i }));
    expect(screen.queryByText("Alex")).not.toBeInTheDocument();
  });

  it("uses compact rows when forceCompactTimeList is set for one candidate", () => {
    const a = buildCandidate("solo", "2026-10-22T10:00:00.000Z");

    render(
      <EventScheduling
        eventId="event-1"
        groupId="group-1"
        eventStatus="confirmed"
        candidates={[{ ...a, status: "selected" }]}
        withdrawnCandidates={[]}
        maybeResponsesEnabled={false}
        minimumAttendees={2}
        proposalDeadlineHours={null}
        replyByLabel={null}
        consensus={{
          confirmRule: "when_most_can_come",
          consensusRule: "majority_active_members",
          minimumAttendees: 2,
          eligibleMemberCount: 4,
          maybeResponsesEnabled: false,
          candidates: [],
        }}
        canAddCandidates={false}
        canRemoveCandidates={false}
        canRespond={false}
        canFinalise={false}
        timeZone="Pacific/Auckland"
        candidateTimeLabels={{ solo: "Wed 22 Oct" }}
        attendanceRosters={{}}
        forceCompactTimeList={true}
      />,
    );

    expect(screen.getByRole("button", { name: /Wed 22 Oct/i })).toBeInTheDocument();
    expect(screen.queryByTestId("gathering-visual")).toBeNull();
  });

  it("shows host actions inside the expanded per-time row", () => {
    const a = buildCandidate("a", "2026-10-20T10:00:00.000Z");
    const b = buildCandidate("b", "2026-10-21T10:00:00.000Z");

    render(
      <EventScheduling
        eventId="event-1"
        groupId="group-1"
        eventStatus="proposing"
        candidates={[a, b]}
        withdrawnCandidates={[]}
        maybeResponsesEnabled={false}
        minimumAttendees={2}
        proposalDeadlineHours={null}
        replyByLabel={null}
        consensus={{
          confirmRule: "when_most_can_come",
          consensusRule: "majority_active_members",
          minimumAttendees: 2,
          eligibleMemberCount: 4,
          maybeResponsesEnabled: false,
          candidates: [],
        }}
        canAddCandidates={false}
        canRemoveCandidates={false}
        canRespond={false}
        canFinalise={true}
        timeZone="Pacific/Auckland"
        candidateTimeLabels={{ a: "Mon 20 Oct", b: "Tue 21 Oct" }}
        attendanceRosters={{}}
        perTimeHosting={{
          canAcceptHost: false,
          canRequestSwap: true,
          hostSwapHasReplacement: true,
          suggestedHostName: null,
          hostingEnabled: true,
          hostPlaceRequired: null,
          defaultLocation: null,
          defaultCoordinates: null,
          viewerHomeLocation: null,
          acceptedHostDisplayName: "Jamie",
        }}
      />,
    );

    expect(screen.getByTestId("per-time-host-actions")).toBeInTheDocument();
    expect(screen.getByText("Host: Jamie")).toBeInTheDocument();
    expect(screen.getByTestId("host-swap-form")).toBeInTheDocument();
  });
});
