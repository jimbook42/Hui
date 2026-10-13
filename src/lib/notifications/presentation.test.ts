import { describe, expect, it } from "vitest";

import { notificationPresentation } from "@/lib/notifications/presentation";
import type { NotificationKind } from "@/lib/notifications/types";

const KINDS: NotificationKind[] = [
  "event_proposed",
  "consensus_ready",
  "event_confirmed",
  "host_proposed",
  "host_accepted",
  "host_declined",
  "contribution_changed",
  "reconnect_reminder",
];

describe("notificationPresentation", () => {
  it("describes every notification kind with a label and action", () => {
    for (const kind of KINDS) {
      const presentation = notificationPresentation(kind);
      expect(presentation.label.length).toBeGreaterThan(0);
      expect(presentation.actionLabel.length).toBeGreaterThan(0);
    }
  });

  it("marks the kinds that ask for a response as actionable", () => {
    const actionable = KINDS.filter((kind) => notificationPresentation(kind).actionable);
    expect(actionable).toEqual(["event_proposed", "consensus_ready", "host_proposed"]);
  });
});
