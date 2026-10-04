import type { EventStatus } from "@/domain/events/types";
import type { AttendanceRoster } from "@/domain/scheduling/attendance-roster";
import { EventDateBadge } from "@/components/hui/event-date-badge";
import { EventStatusPill } from "@/components/hui/status-pill";
import { GatheringVisual } from "@/components/hui/gathering-visual";
import { EventLocationPanel } from "@/components/hui/event-location-panel";
import { HuiSurface } from "@/components/hui/hui-surface";
import { cn } from "@/lib/ui/cn";

type EventHeroProps = {
  title: string;
  status: EventStatus;
  whenLabel: string;
  startsAt: string | null;
  timeZone: string;
  location: string | null;
  groupName: string;
  proposerName: string;
  attendanceRoster?: AttendanceRoster | null;
  confirmedWhen?: string | null;
  className?: string;
};

export function EventHero({
  title,
  status,
  whenLabel,
  startsAt,
  timeZone,
  location,
  groupName,
  proposerName,
  attendanceRoster,
  confirmedWhen,
  className,
}: EventHeroProps) {
  const showConfirmedTime = status === "confirmed" && confirmedWhen;

  return (
    <HuiSurface className={cn("mt-6 space-y-4", className)} elevated padding="md">
      <div className="flex gap-4">
        <EventDateBadge startsAt={startsAt} timeZone={timeZone} />
        <div className="min-w-0 flex-1">
          <p className="hui-type-label text-primary">{groupName}</p>
          <div className="mt-1 flex flex-wrap items-start justify-between gap-2">
            <h2 className="hui-type-display text-foreground">{title}</h2>
            <EventStatusPill status={status} />
          </div>
        </div>
      </div>

      {attendanceRoster && attendanceRoster.members.length > 0 ? (
        <div className="rounded-hui-xl border border-border/60 bg-muted/30 px-2 py-3">
          <p className="px-2 hui-type-label text-muted-foreground">People gathering</p>
          <GatheringVisual roster={attendanceRoster} eventTitle={title} className="mt-1" />
          <p className="px-2 mt-2 hui-type-supporting">
            Initials show who answered — rings show how (not private notes).
          </p>
        </div>
      ) : null}

      {showConfirmedTime ? (
        <p className="hui-type-body text-success" role="status">
          <span className="font-medium">Confirmed:</span> {confirmedWhen}
        </p>
      ) : null}

      {status === "cancelled" ? (
        <p className="hui-type-body text-muted-foreground" role="status">
          This gathering was cancelled. Scheduling and confirmation are closed.
        </p>
      ) : null}

      <dl className="grid gap-2 text-sm">
        <div>
          <dt className="hui-type-label text-muted-foreground">When</dt>
          <dd className="hui-type-body text-foreground">{whenLabel}</dd>
        </div>
        <div>
          <dt className="hui-type-label text-muted-foreground">Proposed by</dt>
          <dd className="hui-type-body text-foreground">{proposerName}</dd>
        </div>
      </dl>

      <EventLocationPanel location={location} />
    </HuiSurface>
  );
}
