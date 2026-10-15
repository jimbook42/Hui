import Link from "next/link";

import { CalendarIcon } from "@/components/hui/icons";
import { StatusPill } from "@/components/hui/status-pill";
import { formatClockTime, formatShortDay, relativeDayLabel } from "@/domain/datetime/display";
import { eventDetailPath } from "@/lib/events/paths";
import type { HomeEvent } from "@/lib/events/home-data";
import type { RecentCancelledGroupEvent } from "@/lib/events/recent-cancelled-for-groups";
import { cn } from "@/lib/ui/cn";

export function upcomingEventForGroup(events: HomeEvent[], groupId: string): HomeEvent | null {
  const active = events.filter(
    (event) =>
      event.groupId === groupId && event.bucket !== "past" && event.bucket !== "cancelled",
  );
  if (active.length === 0) {
    return null;
  }
  return active.sort((a, b) => {
    if (a.startsAt && b.startsAt) {
      return new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime();
    }
    if (a.startsAt) return -1;
    if (b.startsAt) return 1;
    return 0;
  })[0];
}

function upcomingSubtitle(event: HomeEvent): string {
  if (event.startsAt) {
    return `${relativeDayLabel(event.startsAt, event.timeZone)} · ${formatShortDay(event.startsAt, event.timeZone)} ${formatClockTime(event.startsAt, event.timeZone)}`;
  }
  return "Time still to be agreed";
}

function cancelledSubtitle(event: RecentCancelledGroupEvent): string {
  if (event.startsAt) {
    return `${formatShortDay(event.startsAt, event.timeZone)} ${formatClockTime(event.startsAt, event.timeZone)}`;
  }
  return "Date not set";
}

type GroupCardGatheringsProps = {
  upcoming: HomeEvent | null;
  cancelled: RecentCancelledGroupEvent[];
};

export function GroupCardGatherings({ upcoming, cancelled }: GroupCardGatheringsProps) {
  if (!upcoming && cancelled.length === 0) {
    return (
      <p className="rounded-hui-lg bg-muted px-4 py-3 text-sm font-semibold text-muted-foreground">
        Nothing planned yet — a good moment to propose something.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {upcoming ? (
        <Link
          href={eventDetailPath(upcoming.id)}
          className="hui-focus-ring relative z-10 flex min-h-[3.5rem] items-center gap-3 rounded-hui-lg bg-muted px-4 py-2.5 transition-colors hover:bg-[var(--blob-sage)]"
        >
          <CalendarIcon size={20} className="shrink-0 text-accent" />
          <span className="min-w-0 flex-1">
            <span className="block truncate font-extrabold text-foreground">{upcoming.title}</span>
            <span className="block truncate text-sm font-semibold text-muted-foreground">
              {upcomingSubtitle(upcoming)}
            </span>
          </span>
        </Link>
      ) : null}
      {cancelled.map((event) => (
        <Link
          key={event.id}
          href={eventDetailPath(event.id)}
          className={cn(
            "hui-focus-ring relative z-10 flex min-h-[3.25rem] items-center gap-3 rounded-hui-lg border border-border/60 bg-muted/80 px-4 py-2.5 transition-colors hover:bg-muted",
          )}
        >
          <CalendarIcon size={20} className="shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-extrabold text-muted-foreground">Cancelled:</span>
              <span className="min-w-0 truncate font-extrabold text-foreground">{event.title}</span>
              <StatusPill label="Cancelled" tone="muted" />
            </span>
            <span className="block truncate text-sm font-semibold text-muted-foreground">
              {cancelledSubtitle(event)}
            </span>
          </span>
        </Link>
      ))}
    </div>
  );
}
