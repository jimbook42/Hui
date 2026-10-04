import type { AttendanceVisualState } from "@/domain/scheduling/attendance-visual";
import { cn } from "@/lib/ui/cn";

const stateStyles: Record<
  AttendanceVisualState,
  { dot: string; ring: string; icon?: string }
> = {
  yes: {
    dot: "bg-attendance-yes",
    ring: "ring-2 ring-attendance-yes ring-offset-1 ring-offset-surface",
  },
  maybe: {
    dot: "bg-attendance-maybe/30",
    ring: "ring-2 ring-dashed ring-attendance-maybe ring-offset-1 ring-offset-surface",
    icon: "~",
  },
  no: {
    dot: "bg-muted",
    ring: "ring-1 ring-attendance-no opacity-70",
    icon: "×",
  },
  pending: {
    dot: "bg-transparent",
    ring: "border-2 border-dotted border-attendance-pending",
  },
};

type AttendanceDotProps = {
  state: AttendanceVisualState;
  label: string;
  size?: "sm" | "md";
  className?: string;
};

export function AttendanceDot({
  state,
  label,
  size = "md",
  className,
}: AttendanceDotProps) {
  const styles = stateStyles[state];
  const dimension = size === "sm" ? "h-7 w-7 text-[10px]" : "h-9 w-9 text-xs";

  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center rounded-full font-semibold",
        dimension,
        styles.dot,
        styles.ring,
        className,
      )}
      title={label}
      aria-label={label}
    >
      {styles.icon ? (
        <span className="text-muted-foreground" aria-hidden="true">{styles.icon}</span>
      ) : state === "yes" ? (
        <span className="sr-only">{label}</span>
      ) : (
        <span className="sr-only">{label}</span>
      )}
      {state === "yes" ? (
        <span
          className="h-2 w-2 rounded-full bg-primary-foreground/90"
          aria-hidden="true"
        />
      ) : null}
    </span>
  );
}
