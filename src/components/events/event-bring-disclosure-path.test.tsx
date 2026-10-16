import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { EventContributionsSection } from "@/components/contributions/event-contributions-section";
import { DisclosureCard } from "@/components/hui/disclosure-card";

const organiserEmptyProps = {
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

describe("event bring disclosure path", () => {
  it("shows Add something when the disclosure is open like EventDetailsList", () => {
    render(
      <DisclosureCard
        id="contributions"
        title="Who's bringing what"
        summary="Nothing to bring yet"
        defaultOpen
      >
        <EventContributionsSection {...organiserEmptyProps} />
      </DisclosureCard>,
    );

    expect(screen.getAllByRole("heading", { name: "Who's bringing what" }).length).toBeGreaterThan(
      0,
    );
    expect(screen.getByRole("link", { name: "Add something" })).toBeVisible();
  });
});
