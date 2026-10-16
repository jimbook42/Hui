import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { EventHostSection } from "@/components/hosts/event-host-section";
import type { EventHostView } from "@/lib/hosts/queries";

vi.mock("@/app/hosts/actions", () => ({
  acceptHostProposalAction: vi.fn(),
  assignEventHostAction: vi.fn(),
}));

vi.mock("@/components/auth/auth-form", () => ({
  AuthForm: ({ children, submitLabel }: { children: React.ReactNode; submitLabel?: string }) => (
    <form>
      {submitLabel ? <button type="submit">{submitLabel}</button> : null}
      {children}
    </form>
  ),
}));

vi.mock("@/components/hosts/accept-host-with-place-form", () => ({
  AcceptHostWithPlaceForm: () => <div data-testid="accept-host-form">host form</div>,
}));

vi.mock("@/components/hosts/host-swap-request-form", () => ({
  HostSwapRequestForm: () => <div data-testid="host-swap-form">swap</div>,
}));

const baseView: EventHostView = {
  acceptedHost: null,
  pendingProposal: {
    id: "ha-1",
    eventId: "ev-1",
    userId: "host-user",
    status: "proposed",
    displayName: "Alex",
    createdAt: "2026-01-01T00:00:00Z",
  },
  suggestion: null,
};

const baseProps = {
  eventId: "ev-1",
  groupId: "g-1",
  eventStatus: "confirmed" as const,
  eventStartsAt: "2020-01-01T12:00:00.000Z",
  hostingEnabled: true,
  canAssign: true,
  canRespond: true,
  canRequestSwap: false,
  hostSwapHasReplacement: false,
  viewerUserId: "host-user",
  eligibleMembers: [{ userId: "host-user", displayName: "Alex", role: "member" as const, joinedAt: "", consensusRequired: false, hostingStanding: "default" as const }],
  attendanceRoster: null,
  view: baseView,
  viewerHistoryCount: null,
  eventLocation: null,
  eventCoordinates: null,
  hostPlaceRequired: true,
  viewerHomeLocation: null,
};

describe("EventHostSection", () => {
  afterEach(() => {
    cleanup();
  });

  it("shows past-tense host copy without hosting forms when the gathering has ended", () => {
    render(<EventHostSection {...baseProps} />);

    expect(
      screen.getByText("You hosted this hui — thanks for hosting."),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/Hui has suggested/i),
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId("accept-host-form")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Confirm hosting" })).not.toBeInTheDocument();
    expect(screen.queryByText("Suggest someone else")).not.toBeInTheDocument();
  });

  it("shows the accept-host form for an upcoming gathering", () => {
    render(
      <EventHostSection
        {...baseProps}
        eventStatus="proposing"
        eventStartsAt="2099-06-01T12:00:00.000Z"
      />,
    );

    expect(screen.getByTestId("accept-host-form")).toBeInTheDocument();
    expect(
      screen.queryByText("You hosted this hui — thanks for hosting."),
    ).not.toBeInTheDocument();
  });

  it("shows who hosted for another viewer when the gathering has ended", () => {
    render(
      <EventHostSection
        {...baseProps}
        viewerUserId="other-user"
      />,
    );

    expect(screen.getByText("Alex hosted this hui.")).toBeInTheDocument();
    expect(
      screen.queryByText(/Hui has suggested/i),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/you hosted this hui/i),
    ).not.toBeInTheDocument();
  });

  it("shows past-tense copy for accepted host when the gathering has ended", () => {
    const view: EventHostView = {
      acceptedHost: {
        id: "ha-2",
        eventId: "ev-1",
        userId: "host-user",
        status: "accepted",
        displayName: "Alex",
        createdAt: "2026-01-01T00:00:00Z",
      },
      pendingProposal: null,
      suggestion: null,
    };

    render(
      <EventHostSection
        {...baseProps}
        view={view}
        canRespond={false}
      />,
    );

    expect(
      screen.getByText("You hosted this hui — thanks for hosting."),
    ).toBeInTheDocument();
    expect(screen.queryByText(/is hosting/i)).not.toBeInTheDocument();
  });
});
