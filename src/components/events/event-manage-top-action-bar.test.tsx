import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/events/reschedule-confirmed-form", () => ({
  RescheduleConfirmedForm: () => <div data-testid="reschedule-form" />,
}));
vi.mock("@/components/events/cancel-event-button", () => ({
  CancelEventButton: () => <button type="button">Cancel event</button>,
}));
vi.mock("@/components/events/delete-event-form", () => ({
  DeleteEventForm: () => <div data-testid="delete-form" />,
}));

import { EventManageTopActionBar } from "./event-manage-top-action-bar";

describe("EventManageTopActionBar", () => {
  it("renders actions in order with delete last", () => {
    render(
      <EventManageTopActionBar
        eventId="event-1"
        timeZone="Pacific/Auckland"
        defaultStartsAt="2026-10-20T10:00:00.000Z"
        defaultEndsAt={null}
        canReschedule
        canCancel
        canDelete
      />,
    );

    const labels = screen
      .getAllByRole("button")
      .map((button) => button.textContent?.trim() ?? "");
    expect(labels).toEqual(["Reschedule", "Reopen times", "Cancel", "Delete"]);
  });
});
