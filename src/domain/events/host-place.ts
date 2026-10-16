import type { EventCoordinates } from "@/domain/events/location";
import { isValidCoordinates } from "@/domain/events/location";

/** Whether the accepting host must set or confirm the physical place (hosted events only). */
export function hostPlaceRequiredOnAccept(
  hostingEnabled: boolean,
  hostPlaceRequired: boolean | null,
): boolean {
  if (!hostingEnabled) {
    return false;
  }
  return hostPlaceRequired === true;
}

export function hasConfirmableEventPlace(
  location: string | null | undefined,
  coordinates: EventCoordinates | null,
): boolean {
  const place = location?.trim() ?? "";
  if (place.length > 0) {
    return true;
  }
  return coordinates !== null && isValidCoordinates(coordinates);
}

export function hostAcceptPlaceHeading(
  location: string | null | undefined,
  coordinates: EventCoordinates | null,
): string {
  return hasConfirmableEventPlace(location, coordinates) ? "Confirm this place" : "Choose a place";
}

/** Host-only place save must not succeed with an empty venue (avoids silent no-op RPC updates). */
export function hostPlaceSaveValidationError(
  location: string | null | undefined,
  coordinates: EventCoordinates | null,
): string | null {
  if (!hasConfirmableEventPlace(location, coordinates)) {
    return "Confirm where this hui happens before saving.";
  }
  return null;
}
