import { eventIcsFilename } from "@/lib/calendar/event-ics-export";
import { eventCalendarIcsPath } from "@/lib/calendar/paths";

export const CALENDAR_DOWNLOAD_SUCCESS_MESSAGE =
  "Calendar file downloaded. Open it to add this hui to your calendar.";

export type DownloadEventCalendarIcsResult =
  | { ok: true }
  | { ok: false; error: string };

/** Triggers a browser download of the per-event ICS from the existing API route. */
export async function downloadEventCalendarIcs(
  eventId: string,
): Promise<DownloadEventCalendarIcsResult> {
  const response = await fetch(eventCalendarIcsPath(eventId));
  if (!response.ok) {
    return { ok: false, error: "Could not download calendar file." };
  }

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = eventIcsFilename(eventId);
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);

  return { ok: true };
}
