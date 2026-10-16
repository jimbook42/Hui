import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
  GatheringVisual: () => null,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

const now = new Date("2026-10-16T10:00:00.000Z");

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

const past = buildCandidate("past", "2026-10-15T10:00:00.000Z");
const future = buildCandidate("future", "2026-10-20T10:00:00.000Z");

function consensusRow(id: string, startsAt: string, passes: boolean) {
  return {
    candidateId: id,
    startsAt,
    endsAt: null,
    passes,
    acceptedCount: passes ? 1 : 0,
    yesCount: passes ? 1 : 0,
    maybeCount: 0,
    unavailableCount: 0,
    noResponseCount: 2,
    eligibleMemberCount: 3,
    minimumAttendees: 1,
    consensusRule: "minimum_attendees" as const,
    maybeResponsesEnabled: true,
    requiredParticipantCount: 0,
    requiredAcceptedCount: 0,
    failureReason: null,
  };
}

const baseProps = {
  eventId: "ev-1",
  groupId: "g-1",
  eventStatus: "proposing" as const,
  candidates: [past, future],
  withdrawnCandidates: [],
  maybeResponsesEnabled: true,
  minimumAttendees: 1,
  proposalDeadlineHours: null,
  replyByLabel: null,
  consensus: {
    confirmRule: "when_most_can_come" as const,
    consensusRule: "minimum_attendees" as const,
    maybeResponsesEnabled: true,
    eligibleMemberCount: 3,
    minimumAttendees: 1,
    candidates: [
      consensusRow("past", past.startsAt, false),
      consensusRow("future", future.startsAt, true),
    ],
  },
  canAddCandidates: false,
  canRemoveCandidates: false,
  canRespond: true,
  canFinalise: true,
  timeZone: "Pacific/Auckland",
  candidateTimeLabels: { past: "Wed 15 Oct", future: "Mon 20 Oct" },
  attendanceRosters: {},
};

describe("EventScheduling past proposed times", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("marks passed proposed times with a Passed badge", () => {
    render(<EventScheduling {...baseProps} />);

    expect(screen.getByText("Passed")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Confirm this time" })).toHaveLength(1);
  });
});
