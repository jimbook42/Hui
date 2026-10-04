import { cn } from "@/lib/ui/cn";

type EventDateBadgeProps = {
  startsAt: string | null;
  timeZone: string;
  tone?: "primary" | "secondary";
  className?: string;
};

function partsFromIso(startsAt: string, timeZone: string): { day: string; month: string } | null {
  try {
    const date = new Date(startsAt);
    const day = new Intl.DateTimeFormat("en-NZ", {
      day: "numeric",
      timeZone,
    }).format(date);
    const month = new Intl.DateTimeFormat("en-NZ", {
      month: "short",
      timeZone,
    })
      .format(date)
      .replace(/\./g, "")
      .toUpperCase();
    return { day, month };
  } catch {
    return null;
  }
}

export function EventDateBadge({
  startsAt,
  timeZone,
  tone = "primary",
  className,
}: EventDateBadgeProps) {
  if (!startsAt) {
    return null;
  }
  const parts = partsFromIso(startsAt, timeZone);
  if (!parts) {
    return null;
  }

  const toneClass =
    tone === "primary"
      ? "bg-[var(--date-badge-primary)] text-[var(--date-badge-primary-fg)]"
      : "bg-[var(--date-badge-secondary)] text-[var(--date-badge-secondary-fg)]";

  return (
    <div
      className={cn(
        "flex h-[4.25rem] w-[4.25rem] shrink-0 flex-col items-center justify-center rounded-[1.35rem] text-center hui-shadow-sm",
        toneClass,
        className,
      )}
      aria-hidden="true"
    >
      <span className="text-2xl font-bold leading-none">{parts.day}</span>
      <span className="mt-0.5 text-[10px] font-semibold tracking-wide">{parts.month}</span>
    </div>
  );
}
