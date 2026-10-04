import { cn } from "@/lib/ui/cn";

type EventLocationPanelProps = {
  location: string | null;
  className?: string;
};

/** Static map-style context for where a gathering happens — not live tracking. */
export function EventLocationPanel({ location, className }: EventLocationPanelProps) {
  if (!location?.trim()) {
    return null;
  }

  return (
    <div
      className={cn(
        "overflow-hidden rounded-hui-lg border border-border bg-surface",
        className,
      )}
    >
      <div
        className="relative h-24 bg-[linear-gradient(145deg,var(--muted)_0%,color-mix(in_srgb,var(--secondary)_40%,var(--muted))_100%)]"
        aria-hidden="true"
      >
        <svg
          className="absolute inset-0 h-full w-full opacity-40"
          viewBox="0 0 200 80"
          preserveAspectRatio="none"
        >
          <path
            d="M0 40 Q50 20 100 40 T200 35 V80 H0 Z"
            fill="none"
            stroke="var(--border-strong)"
            strokeWidth="1"
          />
          <path
            d="M0 55 Q60 45 120 58 T200 52 V80 H0 Z"
            fill="none"
            stroke="var(--border)"
            strokeWidth="1"
          />
        </svg>
        <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center">
          <span
            className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[var(--shadow-sm)]"
            aria-hidden="true"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path
                d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5A2.5 2.5 0 1 1 12 6a2.5 2.5 0 0 1 0 5.5z"
              />
            </svg>
          </span>
        </div>
      </div>
      <div className="border-t border-border px-4 py-3">
        <p className="hui-type-label text-muted-foreground">Where</p>
        <p className="hui-type-body mt-0.5 text-foreground">{location}</p>
      </div>
    </div>
  );
}
