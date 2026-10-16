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
vi.mock("@/components/events/admin-pick-time-form", () => ({
  AdminPickTimeForm: () => <div data-testid="admin-pick-form" />,
}));
vi.mock("@/components/events/response-deadline-manage-form", () => ({
  ResponseDeadlineManageForm: () => <div data-testid="reply-deadline-form" />,
}));
vi.mock("@/components/events/availability-nudge-button", () => ({
  AvailabilityNudgeButton: () => <button type="button">Nudge</button>,
}));

import { EventManageTopActionBar } from "./event-manage-top-action-bar";

const baseProps = {
  eventId: "event-1",
  timeZone: "Pacific/Auckland",
  defaultStartsAt: "2026-10-20T10:00:00.000Z",
  defaultEndsAt: null,
  defaultDeadlineLocal: "",
  lastAvailabilityNudgeAt: null,
  canReschedule: false,
  canAdminPickTime: false,
  adminPickCandidates: [],
  canEditResponseDeadline: false,
  canNudgeAvailability: false,
  canCancel: false,
  canDelete: false,
};

describe("EventManageTopActionBar", () => {
  it("renders lifecycle actions in order with delete last", () => {
    render(
      <EventManageTopActionBar
        {...baseProps}
        canReschedule
        canAdminPickTime
        adminPickCandidates={[{ id: "c1", label: "Mon" }]}
        canEditResponseDeadline
        canNudgeAvailability
        canCancel
        canDelete
      />,
    );

    const labels = screen
      .getAllByRole("button")
      .map((button) => button.textContent?.trim() ?? "");
    expect(labels).toEqual([
      "Reschedule",
      "Reopen times",
      "Reply by",
      "Pick a different time",
      "Cancel",
      "Delete",
    ]);
  });
});
