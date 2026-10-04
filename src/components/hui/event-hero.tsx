import Link from "next/link";
import type { ReactNode } from "react";

import type { EventCoordinates } from "@/domain/events/location";
import type { EventStatus } from "@/domain/events/types";
import { EventPlaceMap } from "@/components/hui/event-location-panel";
import { EventStatusPill } from "@/components/hui/status-pill";
import { cn } from "@/lib/ui/cn";

type EventHeroProps = {
  title: string;
  status: EventStatus;
  groupName: string;
  groupHref: string;
  location: string | null;
  /** Hui's stored pin for the place. Without it the hero shows a calm band instead of a map. */
  coordinates: EventCoordinates | null;
  className?: string;
  /** Streamed facts (when, where, my status). Rendered inside the sheet under the title. */
  children?: ReactNode;
};

/**
 * The visual centrepiece of an event: the place first (a real, lazily loaded map when pinned), then a
 * soft sheet that rises over it carrying the title and the facts that matter.
 * The shell (map + title) renders immediately; `children` can stream in.
 */
export function EventHero({
  title,
  status,
  groupName,
  groupHref,
  location,
  coordinates,
  className,
  children,
}: EventHeroProps) {
  return (
    <section
      aria-labelledby="event-title"
      className={cn("hui-rise overflow-hidden rounded-hui-2xl bg-surface hui-shadow-lg", className)}
    >
      <EventPlaceMap
        location={location}
        coordinates={coordinates}
        className={coordinates ? "h-52 sm:h-64" : "h-24"}
      >
        <div className="absolute left-4 top-4 z-10">
          <EventStatusPill status={status} />
        </div>
      </EventPlaceMap>

      <div className="relative -mt-7 rounded-t-[2rem] bg-surface px-6 pb-7 pt-7">
        <Link
          href={groupHref}
          className="hui-type-label hui-focus-ring -my-2 inline-flex min-h-11 items-center rounded-full text-accent underline-offset-4 hover:underline"
        >
          {groupName}
        </Link>
        <h1 id="event-title" className="hui-type-display mt-1 text-foreground">
          {title}
        </h1>
        {children}
      </div>
    </section>
  );
}

export function EventHeroMetaSkeleton() {
  return (
    <div className="mt-5 space-y-3" aria-busy="true" aria-label="Loading event details">
      <div className="flex items-center gap-4">
        <div className="hui-skeleton hui-shape-blob-a h-16 w-16 shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="hui-skeleton h-5 w-2/3 !rounded-full" />
          <div className="hui-skeleton h-4 w-1/2 !rounded-full" />
        </div>
      </div>
      <div className="hui-skeleton h-16 !rounded-hui-xl" />
    </div>
  );
}
