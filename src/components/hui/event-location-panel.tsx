import type { ReactNode } from "react";

import { PinIcon } from "@/components/hui/icons";
import { EventMap } from "@/components/map/event-map";
import type { EventCoordinates } from "@/domain/events/location";
import { cn } from "@/lib/ui/cn";

type EventPlaceMapProps = {
  /** Written place. Always shown as text by the caller; here it only names the map. */
  location: string | null;
  /** Hui's own stored pin. Without it there is no honest map to draw. */
  coordinates: EventCoordinates | null;
  className?: string;
  /** Overlay content (status pill etc.). */
  children?: ReactNode;
};

/**
 * "Where this hui is happening". With a stored pin this is a real, lazily loaded interactive map.
 * Without one it is a calm tinted band — Hui never fakes a map for a place it cannot locate. The
 * written place always lives outside the map so location never depends on the map loading.
 */
export function EventPlaceMap({ location, coordinates, className, children }: EventPlaceMapProps) {
  if (coordinates) {
    return (
      <EventMap coordinates={coordinates} location={location} className={className}>
        {children}
      </EventMap>
    );
  }

  const hasPlace = (location?.trim() ?? "").length > 0;

  return (
    <div
      className={cn(
        "relative isolate flex items-center justify-center overflow-hidden bg-sage-soft",
        className,
      )}
    >
      <PinIcon
        size={34}
        className={cn("text-accent", hasPlace ? "opacity-70" : "opacity-40")}
        aria-hidden="true"
      />
      {children ? <div className="absolute inset-0">{children}</div> : null}
    </div>
  );
}
