import { describe, expect, it } from "vitest";

import {
  displayNotificationTitle,
  notificationPresentation,
} from "@/lib/notifications/presentation";
import type { NotificationKind } from "@/lib/notifications/types";

const KINDS: NotificationKind[] = [
  "event_proposed",
  "consensus_ready",
  "event_confirmed",
  "event_cancelled",
  "event_rescheduled",
  "proposal_deadline_reminder",
  "host_proposed",
  "host_accepted",
  "host_declined",
  "contribution_changed",
  "reconnect_reminder",
  "stale_proposal_passed",
  "stale_proposal_auto_cancelled",
  "planning_cycle_opens",
];

describe("displayNotificationTitle", () => {
  it("maps legacy contribution notification titles", () => {
    expect(displayNotificationTitle("Contribution updated")).toBe("What to bring updated");
    expect(displayNotificationTitle("Event confirmed")).toBe("Event confirmed");
  });
});

describe("notificationPresentation", () => {
  it("describes every notification kind with a label and action", () => {
    for (const kind of KINDS) {
      const presentation = notificationPresentation(kind);
      expect(presentation.label.length).toBeGreaterThan(0);
      expect(presentation.actionLabel.length).toBeGreaterThan(0);
    }
  });

  it("falls back safely for unknown kinds", () => {
    const presentation = notificationPresentation("future_kind" as NotificationKind);
    expect(presentation.label).toBe("Update");
    expect(presentation.actionLabel).toBe("View");
  });

  it("marks the kinds that ask for a response as actionable", () => {
    const actionable = KINDS.filter((kind) => notificationPresentation(kind).actionable);
    expect(actionable).toEqual([
      "event_proposed",
      "consensus_ready",
      "event_rescheduled",
      "proposal_deadline_reminder",
      "host_proposed",
    ]);
  });
});
