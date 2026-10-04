import { isSchedulingOpen } from "@/domain/events/lifecycle";
import type { EventStatus } from "@/domain/events/types";
import type { AttendanceVisualState } from "@/domain/scheduling/attendance-visual";
import type { AvailabilityChoice } from "@/domain/scheduling/types";

/** Where a gathering belongs on the Home / Hui surfaces. */
export type HomeBucket = "attention" | "upcoming" | "planning" | "past";

/** The one thing the viewer should do next, when there is something. */
export type HomeAttention = "respond" | "host";

export type HomeEventFacts = {
  status: EventStatus;
  startsAt: string | null;
  endsAt: string | null;
  /** Viewer's response on the time currently on the table (null = no answer yet). */
  viewerResponse: AvailabilityChoice | null;
  /** There is a time on the table the viewer could respond to. */
  hasCandidate: boolean;
  hasPendingHostProposal: boolean;
};

export type HomeClassification = {
  bucket: HomeBucket;
  attention: HomeAttention | null;
};

/** How long after a start time we still treat an end-less gathering as "happening". */
const DEFAULT_DURATION_MS = 3 * 60 * 60 * 1000;

export function hasEventEnded(
  startsAt: string | null,
  endsAt: string | null,
  now: Date = new Date(),
): boolean {
  const end = endsAt ?? (startsAt ? new Date(new Date(startsAt).getTime() + DEFAULT_DURATION_MS).toISOString() : null);
  if (!end) {
    return false;
  }
  return new Date(end).getTime() < now.getTime();
}

export function classifyHomeEvent(facts: HomeEventFacts, now: Date = new Date()): HomeClassification {
  if (facts.status === "cancelled" || facts.status === "completed" || facts.status === "draft") {
    return { bucket: "past", attention: null };
  }

  if (facts.status === "confirmed") {
    if (hasEventEnded(facts.startsAt, facts.endsAt, now)) {
      return { bucket: "past", attention: null };
    }
    return facts.hasPendingHostProposal
      ? { bucket: "attention", attention: "host" }
      : { bucket: "upcoming", attention: null };
  }

  if (isSchedulingOpen(facts.status)) {
    if (facts.hasCandidate && facts.viewerResponse === null) {
      return { bucket: "attention", attention: "respond" };
    }
    if (facts.hasPendingHostProposal) {
      return { bucket: "attention", attention: "host" };
    }
    return { bucket: "planning", attention: null };
  }

  return { bucket: "planning", attention: null };
}

export function attendanceStateFromChoice(
  choice: AvailabilityChoice | null,
  maybeResponsesEnabled = true,
): AttendanceVisualState {
  switch (choice) {
    case "available":
      return "yes";
    case "maybe":
      return maybeResponsesEnabled ? "maybe" : "pending";
    case "unavailable":
      return "no";
    default:
      return "pending";
  }
}

export function viewerStatusLabel(state: AttendanceVisualState): string {
  switch (state) {
    case "yes":
      return "You're in";
    case "maybe":
      return "You said maybe";
    case "no":
      return "You can't make it";
    case "pending":
      return "Needs your answer";
  }
}

type Sortable = { startsAt: string | null };

/** Soonest first; gatherings without a time sink to the end. */
export function compareSoonest(a: Sortable, b: Sortable): number {
  if (a.startsAt && b.startsAt) {
    return new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime();
  }
  if (a.startsAt) return -1;
  if (b.startsAt) return 1;
  return 0;
}

export function compareMostRecent(a: Sortable, b: Sortable): number {
  return -compareSoonest(a, b);
}
