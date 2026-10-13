import { cn } from "@/lib/ui/cn";

type EventDateBadgeProps = {
  startsAt: string | null;
  timeZone: string;
  tone?: "primary" | "secondary" | "sage";
  size?: "md" | "lg";
  /** Shown when no date has been set yet (e.g. a proposal with no chosen time). */
  fallbackLabel?: string;
  className?: string;
};

export function dateBadgeParts(
  startsAt: string,
  timeZone: string,
): { day: string; month: string; weekday: string } | null {
  try {
    const date = new Date(startsAt);
    if (Number.isNaN(date.getTime())) {
      return null;
    }
    const day = new Intl.DateTimeFormat("en-NZ", { day: "numeric", timeZone }).format(date);
    const month = new Intl.DateTimeFormat("en-NZ", { month: "short", timeZone })
      .format(date)
      .replace(/\./g, "")
      .toUpperCase();
    const weekday = new Intl.DateTimeFormat("en-NZ", { weekday: "short", timeZone })
      .format(date)
      .replace(/\./g, "");
    return { day, month, weekday };
  } catch {
    return null;
  }
}

const toneClass = {
  primary: "bg-[var(--blob-blue)]",
  secondary: "bg-[var(--blob-clay)]",
  sage: "bg-[var(--blob-sage)]",
} as const;

/** Organic, slightly asymmetric date blob (see home reference). */
export function EventDateBadge({
  startsAt,
  timeZone,
  tone = "primary",
  size = "md",
  fallbackLabel = "TBC",
  className,
}: EventDateBadgeProps) {
  const parts = startsAt ? dateBadgeParts(startsAt, timeZone) : null;
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
