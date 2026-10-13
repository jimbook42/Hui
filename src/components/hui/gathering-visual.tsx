import type { AttendanceRoster } from "@/domain/scheduling/attendance-roster";
import {
  attendanceVisualAccessibleLabel,
  countAttendance,
  rosterResponseToVisualState,
} from "@/domain/scheduling/attendance-visual";
import {
  gatheringArcStrength,
  layoutGatheringArcs,
  layoutGatheringStage,
  orderMembersForStage,
  type GatheringArcStrength,
} from "@/domain/scheduling/gathering-layout";
import { AttendanceDot } from "@/components/hui/attendance-dot";
import { initialsFor } from "@/components/hui/avatar-stack";
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

/** Approximate rendered node size, used to leave the same breathing room as the logo's gaps. */
const NODE_PX = { xs: 24, sm: 36, md: 44 } as const;
const STAGE_PX = { compact: 240, regular: 336 } as const;

/**
 * Arc look per strength. The logo's ring is drawn in thick rounded strokes that stop short of each
 * member; here the stroke fills in as neighbours say yes. Strength is carried by line weight and
 * dash pattern as well as opacity, never colour alone.
 */
const ARC_STYLE: Record<
  GatheringArcStrength,
  { width: number; opacity: number; dash?: string; colour: string }
> = {
  solid: { width: 5.4, opacity: 1, colour: "var(--gathering-ring)" },
  partial: { width: 5.4, opacity: 0.5, dash: "6 5", colour: "var(--gathering-ring)" },
  open: { width: 1.5, opacity: 0.9, dash: "0.1 3.6", colour: "var(--accent-sage)" },
};

/**
 * People gathered in the Hui logo's ring: members are the nodes and the rounded arcs between them
 * fill in as neighbours say yes. Every node is a real roster entry; state is shown with shape +
 * glyph (not just colour). Private notes are never part of the roster payload.
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
  const { slots, rings, overflowCount, denseRing } = layoutGatheringStage(ordered.length);
  const dotSize = compact ? (denseRing ? "xs" : "sm") : denseRing ? "sm" : "md";
  const hubPercent = denseRing ? 24 : 30;
  const stagePx = compact ? STAGE_PX.compact : STAGE_PX.regular;
  const nodeRadiusUnits = (NODE_PX[dotSize] / 2 / stagePx) * 100;

  const stateAt = (index: number) =>
    rosterResponseToVisualState(ordered[index]?.response ?? null, maybeEnabled);
  const arcs = rings.flatMap((ring) => layoutGatheringArcs(ring, nodeRadiusUnits));
  const innerRing = rings.find((ring) => ring.ring === "inner");

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
          {innerRing ? (
            <circle
              cx="50"
              cy="50"
              r={innerRing.radius}
              fill="none"
              stroke="var(--accent-sage)"
              strokeWidth="0.5"
              strokeDasharray="1.5 2.5"
            />
          ) : null}
          {arcs.map((arc) => {
            const strength = gatheringArcStrength(stateAt(arc.fromMemberIndex), stateAt(arc.toMemberIndex));
            const style = ARC_STYLE[strength];
            return (
              <path
                key={`${arc.fromMemberIndex}-${arc.toMemberIndex}`}
                d={arc.d}
                fill="none"
                stroke={style.colour}
                strokeWidth={style.width}
                strokeLinecap="round"
                strokeDasharray={style.dash}
                opacity={style.opacity}
                className="transition-[opacity,stroke-width] duration-300"
              />
            );
          })}
        </svg>

        <div
          className="hui-breathe absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full bg-surface hui-shadow-md"
          style={{ width: `${hubPercent}%`, aspectRatio: "1 / 1" }}
        >
          <span
            className={cn(
              "font-extrabold leading-none text-foreground",
              compact || denseRing ? "text-lg" : "text-2xl",
            )}
          >
            {counts.yes}
          </span>
          {!compact && !denseRing ? (
            <span className="mt-0.5 text-[0.6875rem] font-extrabold leading-none text-muted-foreground">
              coming
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
