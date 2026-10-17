import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { GroupInviteSection } from "@/components/groups/group-invite-section";
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

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

vi.mock("@/app/groups/invite-actions", () => ({
  regenerateGroupInviteLinkAction: vi.fn(),
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

describe("compact hui layout building blocks", () => {
  it("hides the raw invite URL when hideInviteUrl is set", () => {
    render(
      <GroupInviteSection
        groupId="g1"
        inviteToken="tok"
        appOrigin="https://hui.example"
        hideInviteUrl
      />,
    );
    expect(screen.queryByText(/https:\/\/hui\.example/)).toBeNull();
    expect(screen.getByRole("button", { name: /Share invite/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Copy link/i })).toBeInTheDocument();
  });

  it("uses compact per-time rows for a single proposed time", async () => {
    const user = userEvent.setup();
    const a = buildCandidate("a", "2026-10-20T10:00:00.000Z");

    render(
      <EventScheduling
        eventId="event-1"
        groupId="group-1"
        eventStatus="proposing"
        candidates={[a]}
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
        candidateTimeLabels={{ a: "Mon 20 Oct" }}
        attendanceRosters={{
          a: {
            maybeResponsesEnabled: false,
            members: [{ userId: "u1", displayName: "Alex", response: "yes", submittedLate: false }],
          },
        }}
        forceCompactTimeList={true}
        timesOnlySurface={true}
      />,
    );

    expect(screen.getByText("1 can · 0 can't")).toBeInTheDocument();
    expect(screen.queryByTestId("gathering-visual")).toBeNull();
    expect(await screen.findByText("Alex")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Mon 20 Oct/i }));
    expect(screen.queryByText("Alex")).not.toBeInTheDocument();
  });
});
