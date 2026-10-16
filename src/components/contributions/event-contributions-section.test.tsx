import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { EventContributionsSection } from "@/components/contributions/event-contributions-section";

const baseProps = {
  eventId: "7a8a541c-98e4-4a2f-baa9-5b0f820d2eef",
  groupId: "8973a823-2160-4f39-87de-d2c8c2b6dca8",
  eventStatus: "proposing",
  canCoordinate: true,
  canAssign: true,
  isProposed: true,
  categories: [],
  contributions: [],
  viewerUserId: "08816039-2a78-4619-8601-3152acd89bcc",
  acceptedHostUserId: null,
  members: [{ userId: "08816039-2a78-4619-8601-3152acd89bcc", displayName: "Organiser" }],
  viewerHistoryCount: null,
  sharedDietaryCount: 0,
};

describe("EventContributionsSection", () => {
  it("shows Who's bringing what and organiser Add something with no categories", () => {
    render(<EventContributionsSection {...baseProps} />);

    expect(
      screen.getByRole("heading", { level: 2, name: "Who's bringing what" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Add something" })).toHaveAttribute(
      "href",
      `/groups/${baseProps.groupId}`,
    );
  });
});
