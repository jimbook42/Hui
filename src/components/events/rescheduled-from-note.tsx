import { HuiSurface } from "@/components/hui/hui-surface";
import { formatShortDay, formatTimeSpan } from "@/domain/datetime/display";
import type { EventRescheduleFrom } from "@/lib/events/reschedule-audit";

export function RescheduledFromNote({
  from,
  timeZone,
}: {
  from: EventRescheduleFrom;
  timeZone: string;
}) {
  const label = from.endsAt
    ? formatTimeSpan(from.startsAt, from.endsAt, timeZone)
    : `${formatShortDay(from.startsAt, timeZone)}`;

  return (
    <HuiSurface tone="subtle" shape="soft" padding="md" className="hui-rise-2" role="status">
      <p className="text-sm font-extrabold text-foreground">Rescheduled from {label}</p>
      <p className="mt-1 text-sm font-semibold text-muted-foreground">
        Attendance was reset when the time changed. Answers shown are for the current time only.
      </p>
    </HuiSurface>
  );
}
