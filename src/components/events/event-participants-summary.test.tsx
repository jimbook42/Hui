import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { EventParticipantsSummary } from "@/components/events/event-participants-summary";

describe("EventParticipantsSummary", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("does not show household labels when the feature is off", () => {
    vi.stubEnv("NEXT_PUBLIC_HUI_HOUSEHOLDS_ENABLED", "");
    render(
      <EventParticipantsSummary
        eligibleMemberCount={2}
        view={{
          households: [],
          ungroupedMembers: [
            { userId: "u1", displayName: "Alex" },
            { userId: "u2", displayName: "Sam" },
          ],
        }}
      />,
    );

    expect(screen.queryByText(/household/i)).not.toBeInTheDocument();
    expect(screen.getByText("Alex, Sam")).toBeInTheDocument();
  });
});
