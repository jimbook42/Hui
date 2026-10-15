import type { EventStatus } from "@/domain/events/types";
import {
  formatEventStatusPillLabel,
  isConfirmedEventReasking,
} from "@/domain/scheduling/confirmed-because";
import { cn } from "@/lib/ui/cn";

export type StatusPillTone =
  | "neutral"
  | "active"
  | "success"
  | "muted"
  | "warning"
  | "blue"
  | "clay";

function toneForEventStatus(status: EventStatus): StatusPillTone {
  switch (status) {
    case "confirmed":
    case "completed":
      return "success";
    case "proposing":
    case "voting":
    case "awaiting_agreement":
    case "reopened":
      return "blue";
    case "cancelled":
      return "muted";
    case "draft":
    default:
      return "neutral";
  }
}

const toneClass: Record<StatusPillTone, string> = {
  neutral: "bg-muted text-foreground",
  active: "bg-sage-soft text-foreground",
  success:
    "bg-[color-mix(in_srgb,var(--success)_16%,var(--bg-surface))] text-[color-mix(in_srgb,var(--success)_85%,var(--text-primary))]",
  muted: "bg-muted text-muted-foreground",
  warning:
    "bg-[color-mix(in_srgb,var(--warning)_16%,var(--bg-surface))] text-[color-mix(in_srgb,var(--warning)_88%,var(--text-primary))]",
  blue: "bg-blue-soft text-foreground",
  clay: "bg-clay-soft text-foreground",
};

const baseClass =
  "inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-extrabold leading-tight whitespace-nowrap";

type StatusPillProps = {
  status: EventStatus;
  /** When false on a confirmed hui, the pill shows re-asking (matches hero status line). */
  consensusCurrentlyPasses?: boolean | null;
  className?: string;
};

export function EventStatusPill({ status, consensusCurrentlyPasses, className }: StatusPillProps) {
  const reasking = isConfirmedEventReasking(status, consensusCurrentlyPasses);
  const tone = reasking ? "warning" : toneForEventStatus(status);
  return (
    <span className={cn(baseClass, toneClass[tone], className)}>
      {formatEventStatusPillLabel(status, consensusCurrentlyPasses)}
    </span>
  );
}

type StatusPillLabelProps = {
  label: string;
  tone?: StatusPillTone;
  className?: string;
  icon?: React.ReactNode;
};

export function StatusPill({ label, tone = "neutral", className, icon }: StatusPillLabelProps) {
  return (
    <span className={cn(baseClass, toneClass[tone], className)}>
      {icon}
      {label}
    </span>
  );
}
