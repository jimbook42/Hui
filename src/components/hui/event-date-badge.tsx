import type { EventDateBadgeParts } from "@/domain/datetime/event-hero-dates";
import { formatEventDateBadgeParts } from "@/domain/datetime/event-hero-dates";
import { cn } from "@/lib/ui/cn";

type EventDateBadgeProps = {
  /** Pre-formatted on the server when possible (avoids client Intl during hydration). */
  parts?: EventDateBadgeParts | null;
  startsAt?: string | null;
  timeZone?: string;
  tone?: "primary" | "secondary" | "sage";
  size?: "md" | "lg";
  /** Shown when no date has been set yet (e.g. a proposal with no chosen time). */
  fallbackLabel?: string;
  className?: string;
};

const toneClass = {
  primary: "bg-[var(--blob-blue)]",
  secondary: "bg-[var(--blob-clay)]",
  sage: "bg-[var(--blob-sage)]",
} as const;

/** Organic, slightly asymmetric date blob (see home reference). */
export function EventDateBadge({
  parts: partsProp,
  startsAt = null,
  timeZone = "Pacific/Auckland",
  tone = "primary",
  size = "md",
  fallbackLabel = "TBC",
  className,
}: EventDateBadgeProps) {
  const parts =
    partsProp ??
    (startsAt ? formatEventDateBadgeParts(startsAt, timeZone) : null);
  const dimension = size === "lg" ? "h-24 w-24" : "h-[4.5rem] w-[4.5rem]";

  return (
    <div
      className={cn(
        "flex shrink-0 flex-col items-center justify-center text-center text-foreground",
        tone === "secondary" ? "hui-shape-blob-b" : "hui-shape-blob-a",
        dimension,
        toneClass[tone],
        className,
      )}
      aria-hidden="true"
    >
      {parts ? (
        <>
          <span className={cn("font-black leading-none", size === "lg" ? "text-4xl" : "text-[1.75rem]")}>
            {parts.day}
          </span>
          <span
            className={cn(
              "mt-0.5 font-extrabold tracking-[0.12em]",
              size === "lg" ? "text-xs" : "text-[0.625rem]",
            )}
          >
            {parts.month}
          </span>
        </>
      ) : (
        <span className="text-sm font-extrabold tracking-wide">{fallbackLabel}</span>
      )}
    </div>
  );
}
