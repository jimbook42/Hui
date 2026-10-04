import type { AttendanceVisualState } from "@/domain/scheduling/attendance-visual";
import { cn } from "@/lib/ui/cn";

const stateStyles: Record<
  AttendanceVisualState,
  { dot: string; ring: string; text: string }
> = {
  yes: {
    dot: "bg-attendance-yes",
    ring: "ring-2 ring-attendance-yes ring-offset-2 ring-offset-surface",
    text: "text-primary-foreground",
  },
  maybe: {
    dot: "bg-attendance-maybe/35",
    ring: "ring-2 ring-dashed ring-attendance-maybe ring-offset-2 ring-offset-surface",
    text: "text-foreground",
  },
  no: {
    dot: "bg-muted",
    ring: "ring-1 ring-attendance-no opacity-80",
    text: "text-muted-foreground line-through decoration-2",
  },
  pending: {
    dot: "bg-surface",
    ring: "border-2 border-dotted border-attendance-pending",
    text: "text-muted-foreground",
  },
};

type AttendanceDotProps = {
  state: AttendanceVisualState;
  label: string;
  initial?: string;
  size?: "sm" | "md";
  className?: string;
};

export function AttendanceDot({
  state,
  label,
  initial,
  size = "md",
  className,
}: AttendanceDotProps) {
  const styles = stateStyles[state];
  const dimension = size === "sm" ? "h-8 w-8 text-xs" : "h-10 w-10 text-sm";

  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center rounded-full font-semibold hui-shadow-sm",
        dimension,
        styles.dot,
        styles.ring,
        className,
      )}
      title={label}
      aria-label={label}
    >
      {initial ? (
        <span className={cn("select-none", styles.text)} aria-hidden="true">{initial}</span>
      ) : null}
    </span>
  );
}
