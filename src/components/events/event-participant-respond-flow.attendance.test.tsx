import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { EventParticipantRespondFlow } from "@/components/events/event-participant-respond-flow";
import { setAvailabilityResponseAction } from "@/app/events/scheduling-actions";
import { ATTENDANCE_SAVE_CONNECTION_MESSAGE } from "@/domain/scheduling/availability-action-outcome";
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

const mockRefresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: mockRefresh }),
}));

function buildCandidate(
  id: string,
  labelKey: string,
  startsAt: string,
): EventCandidateRow {
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

const candidateA = buildCandidate("cand-a", "a", "2026-10-22T06:00:00.000Z");
const candidateB = buildCandidate("cand-b", "b", "2026-10-24T05:30:00.000Z");
const candidateC = buildCandidate("cand-c", "c", "2026-10-29T06:00:00.000Z");

const candidateTimeLabels: Record<string, string> = {
  "cand-a": "Thu 22 Oct, 7:00pm",
  "cand-b": "Sat 24 Oct, 6:30pm",
  "cand-c": "Thu 29 Oct, 7:00pm",
};

function renderMultiTimeFlow() {
  return render(
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
      candidate={candidateA}
      proposedCandidates={[candidateA, candidateB, candidateC]}
      placeView={{ kind: "pending", line: "Place still being worked out" }}
      coordinates={null}
      hostingEnabled={true}
      viewerUserId="user-i2"
      initialViewerResponse={null}
      standingAvailabilityHint={null}
      focusTimeLabel="Thursday 22 October, 7:00pm"
      candidateTimeLabels={candidateTimeLabels}
      replyByLabel="Reply by Sat 17 Oct 5:28pm"
      eventStatus="proposing"
    />,
  );
}

function yesButtonForTime(timeLabel: string) {
  const row = screen.getByText(timeLabel).closest("li");
  if (!row) {
    throw new Error(`No row for ${timeLabel}`);
  }
  return within(row).getByRole("button", { name: /Yes/ });
}

describe("EventParticipantRespondFlow multi-time attendance", () => {
  beforeEach(() => {
    vi.mocked(setAvailabilityResponseAction).mockReset();
    mockRefresh.mockReset();
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("serializes three quick saves (one server action in flight) and keeps Yes on each time", async () => {
    const saveOrder: string[] = [];
    let inFlight = 0;
    let maxInFlight = 0;
    const release: Record<string, () => void> = {};
    const gates = new Map<string, Promise<void>>();

    for (const id of ["cand-a", "cand-b", "cand-c"]) {
      gates.set(
        id,
        new Promise<void>((resolve) => {
          release[id] = resolve;
        }),
      );
    }

    vi.mocked(setAvailabilityResponseAction).mockImplementation(async (_prev, formData) => {
      const candidateId = String(formData.get("candidate_id"));
      saveOrder.push(candidateId);
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await gates.get(candidateId);
      inFlight -= 1;
      return { message: "Response saved." };
    });

    const user = userEvent.setup();
    renderMultiTimeFlow();

    const yesA = yesButtonForTime("Thu 22 Oct, 7:00pm");
    const yesB = yesButtonForTime("Sat 24 Oct, 6:30pm");
    const yesC = yesButtonForTime("Thu 29 Oct, 7:00pm");

    await user.click(yesA);
    await user.click(yesB);
    await user.click(yesC);

    expect(saveOrder).toEqual(["cand-a"]);
    expect(maxInFlight).toBe(1);

    release["cand-a"]();
    await waitFor(() => expect(saveOrder).toEqual(["cand-a", "cand-b"]));

    release["cand-b"]();
    await waitFor(() => expect(saveOrder).toEqual(["cand-a", "cand-b", "cand-c"]));

    release["cand-c"]();
    await waitFor(() => {
      expect(yesA).toHaveAttribute("aria-pressed", "true");
      expect(yesB).toHaveAttribute("aria-pressed", "true");
      expect(yesC).toHaveAttribute("aria-pressed", "true");
    });

    expect(setAvailabilityResponseAction).toHaveBeenCalledTimes(3);
    expect(mockRefresh).not.toHaveBeenCalled();
  });

  it("shows friendly Retry copy when the action returns no payload (aborted)", async () => {
    vi.mocked(setAvailabilityResponseAction).mockResolvedValueOnce({} as never);

    const user = userEvent.setup();
    renderMultiTimeFlow();

    await user.click(yesButtonForTime("Sat 24 Oct, 6:30pm"));

    await screen.findByRole("alert");
    expect(screen.getByText(ATTENDANCE_SAVE_CONNECTION_MESSAGE)).toBeInTheDocument();
    expect(yesButtonForTime("Sat 24 Oct, 6:30pm")).toHaveAttribute("aria-pressed", "false");
  });

  it("maps Failed to fetch to friendly copy and Retry re-sends the save", async () => {
    vi.mocked(setAvailabilityResponseAction)
      .mockRejectedValueOnce(new Error("Failed to fetch"))
      .mockResolvedValueOnce({ message: "Response saved." });

    const user = userEvent.setup();
    renderMultiTimeFlow();

    const yesB = yesButtonForTime("Sat 24 Oct, 6:30pm");
    await user.click(yesB);

    await screen.findByRole("alert");
    expect(screen.getByText(ATTENDANCE_SAVE_CONNECTION_MESSAGE)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(yesB).toHaveAttribute("aria-pressed", "true"));
    expect(setAvailabilityResponseAction).toHaveBeenCalledTimes(2);
  });

  it("shows an inline error with Retry when a save is rejected", async () => {
    vi.mocked(setAvailabilityResponseAction)
      .mockResolvedValueOnce({ error: "Network blip." })
      .mockResolvedValueOnce({ message: "Response saved." });

    const user = userEvent.setup();
    renderMultiTimeFlow();

    const yesB = yesButtonForTime("Sat 24 Oct, 6:30pm");
    await user.click(yesB);

    await screen.findByRole("alert");
    expect(screen.getByText("Network blip.")).toBeInTheDocument();
    expect(yesB).toHaveAttribute("aria-pressed", "false");

    await user.click(screen.getByRole("button", { name: "Retry" }));

    await waitFor(() => expect(yesB).toHaveAttribute("aria-pressed", "true"));
    expect(setAvailabilityResponseAction).toHaveBeenCalledTimes(2);
  });
});
