import { cn } from "@/lib/ui/cn";

type EventLocationPanelProps = {
  location: string | null;
  className?: string;
};

/** Illustrated place context — inspired by reference map styling, not a live map SDK. */
export function EventLocationPanel({ location, className }: EventLocationPanelProps) {
  if (!location?.trim()) {
    return null;
  }

  return (
    <div
      className={cn(
        "overflow-hidden rounded-hui-xl border border-border bg-surface",
        className,
      )}
    >
      <div
        className="relative h-28 bg-[#e8e2d4]"
        aria-hidden="true"
      >
        <svg
          className="absolute inset-0 h-full w-full"
          viewBox="0 0 320 112"
          preserveAspectRatio="xMidYMid slice"
        >
          <rect width="320" height="112" fill="#ebe4d6" />
          <path
            d="M0 72 Q80 58 160 68 T320 62 V112 H0 Z"
            fill="#b8d4e8"
            opacity="0.85"
          />
          <path
            d="M40 20 Q120 8 200 24 T320 18"
            fill="none"
            stroke="#c5bfb2"
            strokeWidth="2"
          />
          <path
            d="M20 88 Q100 78 180 90 T320 84"
            fill="none"
            stroke="#d4cec2"
            strokeWidth="1.5"
          />
          <ellipse cx="72" cy="36" rx="28" ry="18" fill="#c8dcc8" opacity="0.9" />
          <ellipse cx="248" cy="44" rx="36" ry="22" fill="#c8dcc8" opacity="0.75" />
        </svg>
        <div className="absolute left-1/2 top-[42%] flex -translate-x-1/2 -translate-y-1/2 flex-col items-center">
          <span
            className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground hui-shadow-md ring-4 ring-surface/90"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
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
