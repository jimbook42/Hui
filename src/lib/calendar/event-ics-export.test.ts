import { describe, expect, it } from "vitest";

import {
  buildEventIcsDocument,
  canDownloadEventIcs,
  eventIcsSequence,
} from "@/lib/calendar/event-ics-export";

const EVENT_ID = "11111111-1111-4111-8111-111111111111";

describe("event ICS export policy", () => {
  it("allows download only for confirmed events with a start time", () => {
    expect(canDownloadEventIcs("confirmed", "2026-01-01T10:00:00Z")).toBe(true);
    expect(canDownloadEventIcs("proposing", "2026-01-01T10:00:00Z")).toBe(false);
    expect(canDownloadEventIcs("confirmed", null)).toBe(false);
    expect(canDownloadEventIcs("cancelled", "2026-01-01T10:00:00Z")).toBe(false);
  });

  it("bumps SEQUENCE from reschedule count", () => {
    expect(eventIcsSequence(0)).toBe(0);
    expect(eventIcsSequence(2)).toBe(2);
  });

  it("includes only event fields in the ICS (no member data)", () => {
    const ics = buildEventIcsDocument({
      detail: {
        id: EVENT_ID,
        title: "Picnic",
        status: "confirmed",
        location: "Park",
        startsAt: "2026-07-01T09:00:00.000Z",
        endsAt: null,
        updatedAt: "2026-06-20T12:00:00.000Z",
        notes: "Bring a rug",
      },
      appOrigin: "https://hui.example",
      rescheduleCount: 1,
    });

    expect(ics).toContain("SEQUENCE:1");
    expect(ics).toContain("https://hui.example/events/");
    expect(ics).not.toContain("Member");
  });
});
