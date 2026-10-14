import { afterEach, describe, expect, it, vi } from "vitest";

import {
  CALENDAR_DOWNLOAD_SUCCESS_MESSAGE,
  downloadEventCalendarIcs,
} from "@/lib/calendar/download-event-calendar-ics";

const EVENT_ID = "11111111-1111-4111-8111-111111111111";

describe("downloadEventCalendarIcs", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("exposes neutral success copy for post-download feedback", () => {
    expect(CALENDAR_DOWNLOAD_SUCCESS_MESSAGE).toMatch(/calendar file downloaded/i);
    expect(CALENDAR_DOWNLOAD_SUCCESS_MESSAGE).toMatch(/open it/i);
  });

  it("returns an error when the API fails", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 404 }));

    const result = await downloadEventCalendarIcs(EVENT_ID);

    expect(result).toEqual({ ok: false, error: "Could not download calendar file." });
    expect(fetch).toHaveBeenCalledWith(`/api/events/${EVENT_ID}/calendar.ics`);
  });
});
