import type { ReactNode } from "react";

import { AttendanceDot } from "@/components/hui/attendance-dot";
import { CheckIcon } from "@/components/hui/icons";
import type { AttendanceVisualState } from "@/domain/scheduling/attendance-visual";
import { cn } from "@/lib/ui/cn";

type AttendanceChoiceProps = {
  /** Attendance state this choice represents, or a neutral action row (e.g. "Suggest another time"). */
  state: AttendanceVisualState | "action";
  label: string;
  selected?: boolean;
  pending?: boolean;
  disabled?: boolean;
  /** Glyph for `action` rows. */
  icon?: ReactNode;
  onClick: () => void;
};

/**
 * One big, thumb-sized answer in the respond flow. Uses the same shape + glyph language as the
 * gathering visual so "yes / maybe / no" mean the same thing everywhere.
 */
export function AttendanceChoice({
  state,
  label,
  selected = false,
  pending = false,
  disabled = false,
  icon,
  onClick,
}: AttendanceChoiceProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={state === "action" ? undefined : selected}
      aria-busy={pending || undefined}
      onClick={onClick}
      className={cn(
        "hui-focus-ring flex min-h-[4.5rem] w-full items-center gap-4 rounded-hui-xl px-4 py-3 text-left text-[1.0625rem] font-extrabold transition duration-200 active:scale-[0.985] disabled:opacity-60",
        selected
          ? "bg-primary text-primary-foreground hui-shadow-md"
          : "bg-surface text-foreground hui-shadow-sm hover:-translate-y-0.5",
        state === "action" && "bg-muted shadow-none",
      )}
    >
      {state === "action" ? (
        <span
          aria-hidden="true"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface text-foreground"
        >
          {icon}
        </span>
      ) : (
        <AttendanceDot state={state} label={label} size="md" />
      )}
      <span className="min-w-0 flex-1 leading-tight">{pending ? "Saving…" : label}</span>
      {selected ? <CheckIcon size={20} strokeWidth={3} className="shrink-0" /> : null}
    </button>
  );
}
