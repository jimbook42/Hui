import type { EventCoordinates } from "@/domain/events/location";

import { hasUsableHomeLocation, type ProfileHomeLocation } from "./home-location";

export type HostVenueMode = "home" | "elsewhere";

export function initialHostVenueMode(
  home: ProfileHomeLocation | null,
  defaultLocation: string | null,
  defaultCoordinates: EventCoordinates | null,
): HostVenueMode {
  if (!hasUsableHomeLocation(home)) {
    return "elsewhere";
  }
  const homeLabel = home!.label.trim();
  if (!defaultLocation?.trim() && !defaultCoordinates) {
    return "home";
  }
  if (defaultLocation?.trim() === homeLabel) {
    return "home";
  }
  return "elsewhere";
}

/** Location fields to persist when the host chose “At my home”. */
export function resolvedHostVenueSubmission(
  venueMode: HostVenueMode,
  home: ProfileHomeLocation | null,
  location: string,
  coordinates: EventCoordinates | null,
): { location: string; coordinates: EventCoordinates | null } {
  if (venueMode === "home" && hasUsableHomeLocation(home)) {
    const saved = home!;
    return { location: saved.label, coordinates: saved.coordinates };
  }
  return { location, coordinates };
}
