import type { AttendanceRoster } from "@/domain/scheduling/attendance-roster";
import {
  attendanceVisualAccessibleLabel,
  rosterResponseToVisualState,
} from "@/domain/scheduling/attendance-visual";
import { layoutGatheringRing } from "@/domain/scheduling/gathering-layout";
import { AttendanceDot } from "@/components/hui/attendance-dot";
import { cn } from "@/lib/ui/cn";

type GatheringVisualProps = {
  roster: AttendanceRoster;
  eventTitle?: string;
  className?: string;
  compact?: boolean;
};

export function GatheringVisual({
  roster,
  eventTitle = "Gathering",
  className,
  compact = false,
}: GatheringVisualProps) {
  const members = roster.members;
  const { slots, overflowCount } = layoutGatheringRing(members.length);
  const heightClass = compact ? "h-36" : "h-44 sm:h-48";

  return (
    <div
      className={cn("relative w-full", heightClass, className)}
      role="img"
      aria-label={`Attendance around ${eventTitle}`}
    >
      <div
        className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full border border-border bg-muted/80 px-4 py-3 text-center shadow-[var(--shadow-sm)]"
        style={{ width: compact ? "5.5rem" : "6.5rem", height: compact ? "5.5rem" : "6.5rem" }}
      >
        <span className="hui-type-label text-primary">Gathering</span>
        <span className="mt-0.5 line-clamp-2 text-[10px] font-medium leading-tight text-foreground">
          {eventTitle}
        </span>
      </div>

      {slots.map((slot) => {
        const member = members[slot.memberIndex];
        if (!member) {
          return null;
        }
        const state = rosterResponseToVisualState(
          member.response,
          roster.maybeResponsesEnabled,
        );
        const label = attendanceVisualAccessibleLabel(member.displayName, state);
        const initials = member.displayName.trim().charAt(0).toUpperCase() || "?";

        return (
          <div
            key={member.userId}
            className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-0.5"
            style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
          >
            <AttendanceDot state={state} label={label} size={compact ? "sm" : "md"} />
            <span className="max-w-[3.25rem] truncate text-[10px] text-muted-foreground">
              {initials}
            </span>
          </div>
        );
      })}

      {overflowCount > 0 ? (
        <p className="absolute bottom-0 left-0 right-0 text-center text-xs text-muted-foreground">
          +{overflowCount} more{" "}
          <span className="sr-only">members not shown in the ring</span>
        </p>
      ) : null}

      <ul className="sr-only">
        {members.map((member) => {
          const state = rosterResponseToVisualState(
            member.response,
            roster.maybeResponsesEnabled,
          );
          return (
            <li key={member.userId}>
              {attendanceVisualAccessibleLabel(member.displayName, state)}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
