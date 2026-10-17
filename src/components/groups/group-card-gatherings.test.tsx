import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { GroupCardGatherings } from "@/components/groups/group-card-gatherings";
import type { HomeEvent } from "@/lib/events/home-data";
import type { RecentCancelledGroupEvent } from "@/lib/events/recent-cancelled-for-groups";

afterEach(() => {
  cleanup();
});

function makeUpcoming(overrides: Partial<HomeEvent> = {}): HomeEvent {
  return {
    id: "upcoming-id",
    title: "QA 0183 SelfHost",
    status: "confirmed",
    groupId: "group-1",
    groupName: "QA 0183 Trio",
    location: null,
    startsAt: "2026-12-12T23:00:00.000Z",
    endsAt: null,
    timeZone: "Pacific/Auckland",
    candidateId: null,
    viewerResponse: null,
    viewerState: "pending",
    bucket: "upcoming",
    attention: null,
    maybeResponsesEnabled: true,
    roster: null,
    counts: null,
    hostName: null,
    contributionsOpen: null,
    proposalDatePassed: false,
    relativeDayChip: null,
    consensusCurrentlyPasses: null,
    confirmationMethod: null,
    leadingProposedTime: false,
    ...overrides,
  };
}

function makeCancelled(overrides: Partial<RecentCancelledGroupEvent> = {}): RecentCancelledGroupEvent {
  return {
    id: "cancelled-id",
    title: "QA 0183 Cancelled picnic",
    groupId: "group-1",
    startsAt: "2026-10-10T05:00:00.000Z",
    timeZone: "Pacific/Auckland",
    cancelledAt: "2026-10-14T08:00:00.000Z",
    ...overrides,
  };
}

describe("GroupCardGatherings", () => {
  it("shows upcoming hui and a recent cancellation on the same card", () => {
    render(
      <GroupCardGatherings
        upcoming={makeUpcoming()}
        cancelled={[makeCancelled()]}
      />,
    );

    expect(screen.getByText("QA 0183 SelfHost")).toBeInTheDocument();
    expect(screen.getByText("Cancelled:")).toBeInTheDocument();
    expect(screen.getByText("QA 0183 Cancelled picnic")).toBeInTheDocument();
    expect(screen.getAllByText("Cancelled").length).toBeGreaterThanOrEqual(1);
  });

  it("shows a cancelled hui date from proposed times when starts_at is unset", () => {
    render(
      <GroupCardGatherings
        upcoming={null}
        cancelled={[
          makeCancelled({
            startsAt: "2026-11-12T06:00:00.000Z",
            title: "R7 OrgPicksHost",
          }),
        ]}
      />,
    );

    expect(screen.getByText(/12 Nov/i)).toBeInTheDocument();
    expect(screen.queryByText("Date not set")).not.toBeInTheDocument();
  });
});
