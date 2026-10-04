import type { EventStatus } from "@/domain/events/types";
import type { AttendanceRoster } from "@/domain/scheduling/attendance-roster";
import { EventStatusPill } from "@/components/hui/status-pill";
import { GatheringVisual } from "@/components/hui/gathering-visual";
import { EventLocationPanel } from "@/components/hui/event-location-panel";
import { HuiSurface } from "@/components/hui/hui-surface";
import { cn } from "@/lib/ui/cn";

type EventHeroProps = {
  title: string;
  status: EventStatus;
  whenLabel: string;
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
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="hui-type-label text-primary">{groupName}</p>
          <h2 className="hui-type-display mt-1 text-foreground">{title}</h2>
        </div>
        <EventStatusPill status={status} />
      </div>

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

      {attendanceRoster && attendanceRoster.members.length > 0 ? (
        <div className="border-t border-border pt-4">
          <p className="hui-type-label text-muted-foreground">Who&apos;s around the table</p>
          <GatheringVisual roster={attendanceRoster} eventTitle={title} className="mt-2" />
          <p className="mt-2 hui-type-supporting">
            Shapes and rings show how people answered — not private notes.
          </p>
        </div>
      ) : null}

      <EventLocationPanel location={location} />
    </HuiSurface>
  );
}
