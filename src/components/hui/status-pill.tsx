import type { EventStatus } from "@/domain/events/types";
import { eventStatusLabel } from "@/lib/events/labels";
import { cn } from "@/lib/ui/cn";

type StatusPillTone = "neutral" | "active" | "success" | "muted" | "warning";

function toneForEventStatus(status: EventStatus): StatusPillTone {
  switch (status) {
    case "confirmed":
    case "completed":
      return "success";
    case "proposing":
    case "voting":
    case "awaiting_agreement":
    case "reopened":
      return "active";
    case "cancelled":
      return "muted";
    case "draft":
      return "neutral";
    default:
      return "neutral";
  }
}

const toneClass: Record<StatusPillTone, string> = {
  neutral: "bg-muted text-foreground border-border",
  active: "bg-secondary text-secondary-foreground border-border",
  success: "bg-[color-mix(in_srgb,var(--success)_12%,var(--surface))] text-success border-[color-mix(in_srgb,var(--success)_25%,var(--border))]",
  muted: "bg-muted text-muted-foreground border-border",
  warning: "bg-[color-mix(in_srgb,var(--warning)_12%,var(--surface))] text-warning border-[color-mix(in_srgb,var(--warning)_25%,var(--border))]",
};

type StatusPillProps = {
  status: EventStatus;
  className?: string;
};

export function EventStatusPill({ status, className }: StatusPillProps) {
  const tone = toneForEventStatus(status);
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        toneClass[tone],
        className,
      )}
    >
      {eventStatusLabel(status)}
    </span>
  );
}

type StatusPillLabelProps = {
  label: string;
  tone?: StatusPillTone;
  className?: string;
};

export function StatusPill({ label, tone = "neutral", className }: StatusPillLabelProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        toneClass[tone],
        className,
      )}
    >
      {label}
    </span>
  );
}
