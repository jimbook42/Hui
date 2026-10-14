import type { EventDetail } from "@/lib/events/types";
import {
  buildIcsCalendar,
  stableEventIcsUid,
  type IcsEventInput,
} from "@/domain/calendar/ics";
import { eventDetailPath } from "@/lib/events/paths";

export type EventIcsExportInput = {
  detail: Pick<
    EventDetail,
    "id" | "title" | "status" | "location" | "startsAt" | "endsAt" | "updatedAt" | "notes"
  >;
  appOrigin: string;
  rescheduleCount: number;
};

export function canDownloadEventIcs(
  status: EventDetail["status"],
  startsAt: string | null,
): boolean {
  return status === "confirmed" && Boolean(startsAt);
}

export function eventIcsSequence(rescheduleNewTimeCount: number): number {
  return Math.max(0, rescheduleNewTimeCount);
}

function defaultEndUtc(startsAt: string, endsAt: string | null): string {
  if (endsAt) {
    return endsAt;
  }
  const start = new Date(startsAt);
  return new Date(start.getTime() + 60 * 60 * 1000).toISOString();
}

export function buildEventIcsDocument(input: EventIcsExportInput): string {
  const { detail, appOrigin, rescheduleCount } = input;
  if (!detail.startsAt) {
    throw new Error("Confirmed event is missing a start time");
  }

  const eventUrl = `${appOrigin.replace(/\/$/, "")}${eventDetailPath(detail.id)}`;
  const descriptionParts = [`View this hui in Hui: ${eventUrl}`];
  if (detail.notes?.trim()) {
    descriptionParts.push(detail.notes.trim());
  }

  const icsEvent: IcsEventInput = {
    uid: stableEventIcsUid(detail.id, appOrigin),
    summary: detail.title,
    description: descriptionParts.join("\n\n"),
    location: detail.location,
    startsAtUtc: detail.startsAt,
    endsAtUtc: defaultEndUtc(detail.startsAt, detail.endsAt),
    dtStampUtc: detail.updatedAt,
    sequence: eventIcsSequence(rescheduleCount),
    status: detail.status === "cancelled" ? "CANCELLED" : "CONFIRMED",
  };

  return buildIcsCalendar([icsEvent]);
}

export function eventIcsFilename(eventId: string): string {
  return `hui-${eventId}.ics`;
}
