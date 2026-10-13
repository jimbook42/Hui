import { describe, expect, it } from "vitest";

import {
  buildIcsCalendar,
  escapeIcsText,
  formatIcsUtcInstant,
  stableEventIcsUid,
} from "@/domain/calendar/ics";

describe("ICS generation", () => {
  it("escapes RFC 5545 text values", () => {
    expect(escapeIcsText("a;b\\c\nd")).toBe("a\\;b\\\\c\\nd");
  });

  it("formats instants in UTC", () => {
    expect(formatIcsUtcInstant("2026-06-15T14:30:00.000Z")).toBe("20260615T143000Z");
  });

  it("builds a VEVENT with required fields", () => {
    const ics = buildIcsCalendar([
      {
        uid: "hui-event-abc@hui.test",
        summary: "Team lunch",
        description: "See https://hui.test/events/abc",
        location: "Cafe",
        startsAtUtc: "2026-06-15T10:00:00.000Z",
        endsAtUtc: "2026-06-15T11:00:00.000Z",
        dtStampUtc: "2026-06-10T08:00:00.000Z",
        sequence: 2,
        status: "CONFIRMED",
      },
    ]);

    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("UID:hui-event-abc@hui.test");
    expect(ics).toContain("DTSTART:20260615T100000Z");
    expect(ics).toContain("DTEND:20260615T110000Z");
    expect(ics).toContain("SEQUENCE:2");
    expect(ics).toContain("STATUS:CONFIRMED");
    expect(ics).toContain("SUMMARY:Team lunch");
    expect(ics).toContain("LOCATION:Cafe");
    expect(ics.endsWith("\r\n"));
  });

  it("folds long property lines", () => {
    const longSummary = "A".repeat(90);
    const ics = buildIcsCalendar([
      {
        uid: "x@y",
        summary: longSummary,
        description: "d",
        startsAtUtc: "2026-01-01T00:00:00.000Z",
        endsAtUtc: "2026-01-01T01:00:00.000Z",
        dtStampUtc: "2026-01-01T00:00:00.000Z",
        sequence: 0,
      },
    ]);
    expect(ics).toMatch(/SUMMARY:[^\r\n]+\r\n [^\r\n]+/);
  });

  it("uses a stable UID from event id and app host", () => {
    expect(stableEventIcsUid("11111111-1111-4111-8111-111111111111", "https://hui.example")).toBe(
      "hui-event-11111111-1111-4111-8111-111111111111@hui.example",
    );
  });
});
