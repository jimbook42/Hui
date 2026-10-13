const CRLF = "\r\n";
const MAX_LINE_OCTETS = 75;

export type IcsEventInput = {
  uid: string;
  summary: string;
  description: string;
  location?: string | null;
  startsAtUtc: string;
  endsAtUtc: string;
  dtStampUtc: string;
  sequence: number;
  status?: "CONFIRMED" | "CANCELLED";
};

export function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n/g, "\\n")
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\n");
}

export function formatIcsUtcInstant(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    throw new Error("Invalid instant for ICS");
  }
  const parts = {
    y: date.getUTCFullYear(),
    mo: date.getUTCMonth() + 1,
    d: date.getUTCDate(),
    h: date.getUTCHours(),
    mi: date.getUTCMinutes(),
    s: date.getUTCSeconds(),
  };
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${parts.y}${pad(parts.mo)}${pad(parts.d)}T${pad(parts.h)}${pad(parts.mi)}${pad(parts.s)}Z`;
}

function foldIcsLine(line: string): string {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(line);
  if (bytes.length <= MAX_LINE_OCTETS) {
    return line;
  }

  const chunks: string[] = [];
  let offset = 0;
  while (offset < bytes.length) {
    let take = MAX_LINE_OCTETS;
    if (offset > 0) {
      take = MAX_LINE_OCTETS - 1;
    }
    let sliceEnd = offset + take;
    while (sliceEnd > offset && (bytes[sliceEnd - 1]! & 0xc0) === 0x80) {
      sliceEnd -= 1;
    }
    if (sliceEnd === offset) {
      sliceEnd = Math.min(offset + take, bytes.length);
    }
    const piece = new TextDecoder().decode(bytes.slice(offset, sliceEnd));
    chunks.push(offset === 0 ? piece : ` ${piece}`);
    offset = sliceEnd;
  }
  return chunks.join(CRLF);
}

function property(name: string, value: string): string {
  return foldIcsLine(`${name}:${value}`);
}

export function buildIcsCalendar(events: IcsEventInput[]): string {
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Hui//Event Export//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];

  for (const event of events) {
    lines.push("BEGIN:VEVENT");
    lines.push(property("UID", event.uid));
    lines.push(property("DTSTAMP", formatIcsUtcInstant(event.dtStampUtc)));
    lines.push(property("DTSTART", formatIcsUtcInstant(event.startsAtUtc)));
    lines.push(property("DTEND", formatIcsUtcInstant(event.endsAtUtc)));
    lines.push(property("SUMMARY", escapeIcsText(event.summary)));
    lines.push(property("DESCRIPTION", escapeIcsText(event.description)));
    if (event.location?.trim()) {
      lines.push(property("LOCATION", escapeIcsText(event.location.trim())));
    }
    lines.push(property("SEQUENCE", String(Math.max(0, event.sequence))));
    if (event.status === "CANCELLED") {
      lines.push("STATUS:CANCELLED");
    } else {
      lines.push("STATUS:CONFIRMED");
    }
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return `${lines.join(CRLF)}${CRLF}`;
}

export function stableEventIcsUid(eventId: string, calendarDomain: string): string {
  const domain = calendarDomain.replace(/^https?:\/\//, "").replace(/\/$/, "");
  return `hui-event-${eventId}@${domain || "hui"}`;
}
