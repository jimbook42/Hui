import type { EventStatus } from "./types";
import { EVENT_STATUSES, TERMINAL_EVENT_STATUSES } from "./types";

export const INITIAL_EVENT_STATUS: EventStatus = "proposing";

/** The only status from which HUI-010 confirms an event. */
export const FINALISABLE_EVENT_STATUS: EventStatus = "proposing";

export function isSchedulingOpen(status: EventStatus): boolean {
  return status !== "confirmed" && !TERMINAL_EVENT_STATUSES.includes(status);
}

export function canChangeEventSchedule(status: EventStatus): boolean {
  return isSchedulingOpen(status);
}

export function assertCanFinalise(status: EventStatus): string | null {
  if (status === "confirmed") {
    return "This event is already confirmed.";
  }
  if (status === "cancelled") {
    return "Cancelled events cannot be confirmed.";
  }
  if (status === "completed") {
    return "Completed events cannot be confirmed.";
  }
  if (status !== FINALISABLE_EVENT_STATUS) {
    return "Only a proposing event can be confirmed.";
  }
  return null;
}

export function isEventStatus(value: string): value is EventStatus {
  return (EVENT_STATUSES as readonly string[]).includes(value);
}

export function assertMetadataEditable(status: EventStatus): string | null {
  if (TERMINAL_EVENT_STATUSES.includes(status)) {
    return "This event can no longer be edited.";
  }
  return null;
}

export function validateMetadataUpdate(
  currentStatus: EventStatus,
  nextStatus: EventStatus,
): string | null {
  const terminalError = assertMetadataEditable(currentStatus);
  if (terminalError) {
    return terminalError;
  }
  if (currentStatus === "cancelled" && nextStatus !== "cancelled") {
    return "Cancelled events cannot be reactivated from a regular edit.";
  }
  if (nextStatus !== currentStatus) {
    return "Status changes are not available in this flow yet.";
  }
  return null;
}

export function cancellationPatch(now: Date = new Date()): {
  status: EventStatus;
  cancelled_at: string;
} {
  return {
    status: "cancelled",
    cancelled_at: now.toISOString(),
  };
}
