import type { AttendanceVisualState } from "@/domain/scheduling/attendance-visual";
import { CheckIcon, CrossIcon, HelpIcon } from "@/components/hui/icons";
import { cn } from "@/lib/ui/cn";

/**
 * One member's attendance. State is carried by shape and glyph as well as colour:
 * solid + check (yes), dashed ring + "?" (maybe), faded + cross (no), dotted outline (pending).
 */
const stateStyles: Record<AttendanceVisualState, { dot: string; text: string; badge?: string }> = {
  yes: {
    dot: "bg-attendance-yes ring-[3px] ring-[color-mix(in_srgb,var(--attendance-yes)_30%,transparent)]",
    text: "text-[#ffffff]",
    badge: "bg-attendance-yes text-[#ffffff]",
  },
  maybe: {
    dot: "border-2 border-dashed border-attendance-maybe bg-[color-mix(in_srgb,var(--attendance-maybe)_22%,var(--bg-surface))]",
    text: "text-foreground",
    badge: "bg-attendance-maybe text-[#ffffff]",
  },
  no: {
    dot: "bg-muted opacity-60",
    text: "text-muted-foreground",
    badge: "bg-attendance-no text-[#ffffff]",
  },
  pending: {
    dot: "border-2 border-dotted border-attendance-pending bg-surface",
    text: "text-muted-foreground",
  },
};

const sizes = {
  xs: { box: "h-6 w-6 text-[0.625rem]", badge: "h-3.5 w-3.5", icon: 8 },
  sm: { box: "h-9 w-9 text-xs", badge: "h-4 w-4", icon: 9 },
  md: { box: "h-11 w-11 text-sm", badge: "h-[1.125rem] w-[1.125rem]", icon: 10 },
  lg: { box: "h-14 w-14 text-base", badge: "h-5 w-5", icon: 12 },
} as const;

type AttendanceDotProps = {
  state: AttendanceVisualState;
  label: string;
  initial?: string;
  size?: keyof typeof sizes;
  className?: string;
  /** Hide the corner glyph (e.g. inside the legend where the label already explains it). */
  hideBadge?: boolean;
};

export function AttendanceDot({
  state,
  label,
  initial,
  size = "md",
  className,
  hideBadge = false,
}: AttendanceDotProps) {
  const styles = stateStyles[state];
  const dims = sizes[size];

  return (
    <span
      className={cn("relative inline-flex shrink-0", className)}
      title={label}
      role="img"
      aria-label={label}
    >
      <span
        className={cn(
          "inline-flex items-center justify-center rounded-full font-extrabold",
          dims.box,
          styles.dot,
        )}
      >
        {initial ? (
          <span className={cn("select-none", styles.text)} aria-hidden="true">
            {initial}
          </span>
        ) : null}
      </span>
      {styles.badge && !hideBadge ? (
        <span
          aria-hidden="true"
          className={cn(
            "absolute -bottom-0.5 -right-0.5 inline-flex items-center justify-center rounded-full ring-2 ring-[var(--bg-surface)]",
            dims.badge,
            styles.badge,
          )}
        >
          {state === "yes" ? <CheckIcon size={dims.icon} strokeWidth={3} /> : null}
          {state === "maybe" ? <HelpIcon size={dims.icon} strokeWidth={3} /> : null}
          {state === "no" ? <CrossIcon size={dims.icon} strokeWidth={3} /> : null}
        </span>
      ) : null}
    </span>
  );
}
