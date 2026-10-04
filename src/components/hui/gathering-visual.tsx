import type { AttendanceRoster } from "@/domain/scheduling/attendance-roster";
import {
  attendanceVisualAccessibleLabel,
  countAttendance,
  rosterResponseToVisualState,
} from "@/domain/scheduling/attendance-visual";
import { layoutGatheringStage, orderMembersForStage } from "@/domain/scheduling/gathering-layout";
import { AttendanceDot } from "@/components/hui/attendance-dot";
import { initialsFor } from "@/components/hui/avatar-stack";
import { HuiGatheringMark } from "@/components/hui/hui-gathering-mark";
import { cn } from "@/lib/ui/cn";

type GatheringVisualProps = {
  roster: AttendanceRoster;
  eventTitle?: string;
  className?: string;
  /** Smaller stage for use inside candidate cards. */
  compact?: boolean;
  /** Hide the counts row under the stage. */
  hideCounts?: boolean;
};

function CountChip({
  count,
  label,
  tone,
}: {
  count: number;
  label: string;
  tone: "yes" | "maybe" | "no" | "pending";
}) {
  const toneClass = {
    yes: "bg-[color-mix(in_srgb,var(--attendance-yes)_16%,var(--bg-surface))]",
    maybe: "bg-[color-mix(in_srgb,var(--attendance-maybe)_18%,var(--bg-surface))]",
    no: "bg-muted",
    pending: "bg-muted",
  }[tone];
  return (
    <li
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-extrabold text-foreground",
        toneClass,
      )}
    >
      <AttendanceDot state={tone} label={label} size="xs" hideBadge />
      <span>
        {count} {label}
      </span>
    </li>
  );
}

/**
 * People gathered around a central point. Every dot is a real roster entry; state is shown with
 * shape + glyph (not just colour). Private notes are never part of the roster payload.
 */
export function GatheringVisual({
  roster,
  eventTitle = "Gathering",
  className,
  compact = false,
  hideCounts = false,
}: GatheringVisualProps) {
  const maybeEnabled = roster.maybeResponsesEnabled;
  const counts = countAttendance(roster.members, maybeEnabled);
  const ordered = orderMembersForStage(roster.members, (member) =>
    rosterResponseToVisualState(member.response, maybeEnabled),
  );
  const { slots, overflowCount, denseRing } = layoutGatheringStage(ordered.length);
  const dotSize = compact ? (denseRing ? "xs" : "sm") : denseRing ? "sm" : "md";
  const hubPercent = denseRing ? 26 : 32;

  return (
    <div className={cn("w-full", className)}>
      <div
        className={cn(
          "relative mx-auto aspect-square w-full",
          compact ? "max-w-[15rem]" : "max-w-[21rem]",
        )}
        role="img"
        aria-label={`Attendance around ${eventTitle}: ${counts.yes} can come, ${counts.maybe} could make it work, ${counts.no} can't come, ${counts.pending} no answer yet`}
      >
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full"
          viewBox="0 0 100 100"
          aria-hidden="true"
        >
          <circle cx="50" cy="50" r="47" fill="var(--sage-soft)" />
          <circle
            cx="50"
            cy="50"
            r={denseRing ? 40 : 35}
            fill="none"
            stroke="var(--accent-sage)"
            strokeWidth="0.5"
            strokeDasharray="1.5 2.5"
          />
          {denseRing ? (
            <circle
              cx="50"
              cy="50"
              r="22"
              fill="none"
              stroke="var(--accent-sage)"
              strokeWidth="0.5"
              strokeDasharray="1.5 2.5"
            />
          ) : null}
        </svg>

        <div
          className="hui-breathe absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full bg-surface hui-shadow-md"
          style={{ width: `${hubPercent}%`, aspectRatio: "1 / 1" }}
        >
          <HuiGatheringMark size={compact ? 26 : denseRing ? 30 : 38} />
          {!compact && !denseRing ? (
            <span className="mt-0.5 text-[0.6875rem] font-extrabold leading-none text-foreground">
              {counts.yes} in
            </span>
          ) : null}
        </div>

        {slots.map((slot) => {
          const member = ordered[slot.memberIndex];
          if (!member) {
            return null;
          }
          const state = rosterResponseToVisualState(member.response, maybeEnabled);
          return (
            <div
              key={member.userId}
              className="absolute z-10 -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
            >
              <AttendanceDot
                state={state}
                label={attendanceVisualAccessibleLabel(member.displayName, state)}
                size={dotSize}
                initial={initialsFor(member.displayName)}
              />
            </div>
          );
        })}
      </div>

      {overflowCount > 0 ? (
        <p className="mt-2 text-center text-xs font-bold text-muted-foreground">
          +{overflowCount} more not shown — see the counts below
        </p>
      ) : null}

      {!hideCounts ? (
        <ul className="mt-4 flex flex-wrap justify-center gap-2">
          <CountChip count={counts.yes} label="coming" tone="yes" />
          {maybeEnabled ? <CountChip count={counts.maybe} label="maybe" tone="maybe" /> : null}
          <CountChip count={counts.no} label="can't" tone="no" />
          <CountChip count={counts.pending} label="waiting" tone="pending" />
        </ul>
      ) : null}

      <ul className="sr-only">
        {roster.members.map((member) => {
          const state = rosterResponseToVisualState(member.response, maybeEnabled);
          return (
            <li key={member.userId}>{attendanceVisualAccessibleLabel(member.displayName, state)}</li>
          );
        })}
      </ul>
    </div>
  );
}
