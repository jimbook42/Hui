import type { AttendanceRoster } from "@/domain/scheduling/attendance-roster";
import {
  attendanceVisualAccessibleLabel,
  rosterResponseToVisualState,
} from "@/domain/scheduling/attendance-visual";
import { layoutGatheringRing } from "@/domain/scheduling/gathering-layout";
import { AttendanceDot } from "@/components/hui/attendance-dot";
import { HuiGatheringMark } from "@/components/hui/hui-gathering-mark";
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
  const heightClass = compact ? "h-40" : "h-48 sm:h-52";
  const hubSize = compact ? 52 : 64;

  return (
    <div
      className={cn("relative w-full", heightClass, className)}
      role="img"
      aria-label={`Attendance around ${eventTitle}`}
    >
      <svg
        className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[var(--gathering-ring)] opacity-25"
        width={compact ? 200 : 240}
        height={compact ? 200 : 240}
        viewBox="0 0 240 240"
        aria-hidden="true"
      >
        <circle cx="120" cy="120" r="88" fill="none" stroke="currentColor" strokeWidth="3" />
      </svg>

      <div
        className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full border border-border/80 bg-surface px-3 py-2 text-center hui-shadow-md"
        style={{ width: hubSize + 24, minHeight: hubSize + 16 }}
      >
        <HuiGatheringMark size={hubSize} />
        <span className="mt-1 line-clamp-2 max-w-[5.5rem] text-[10px] font-semibold leading-tight text-foreground">
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
        const initial = member.displayName.trim().charAt(0).toUpperCase() || "?";

        return (
          <div
            key={member.userId}
            className="absolute z-10 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
            style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
          >
            <AttendanceDot
              state={state}
              label={label}
              size={compact ? "sm" : "md"}
              initial={initial}
            />
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
