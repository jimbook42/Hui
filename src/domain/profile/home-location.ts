import {
  coordinatesFromRow,
  isValidCoordinates,
  parseOptionalCoordinates,
  type EventCoordinates,
} from "@/domain/events/location";

export type ProfileHomeLocation = {
  label: string;
  coordinates: EventCoordinates | null;
};

export function homeLocationFromProfileRow(row: {
  home_location_label: string | null;
  home_location_lat: number | string | null;
  home_location_lng: number | string | null;
}): ProfileHomeLocation | null {
  const label = row.home_location_label?.trim() ?? "";
  const coordinates = coordinatesFromRow(row.home_location_lat, row.home_location_lng);
  if (!label && !coordinates) {
    return null;
  }
  return { label, coordinates };
}

export function hasUsableHomeLocation(home: ProfileHomeLocation | null | undefined): boolean {
  if (!home) {
    return false;
  }
  return Boolean(home.label.trim()) || isValidCoordinates(home.coordinates);
}

export function parseHomeLocationForm(
  labelRaw: unknown,
  latRaw: unknown,
  lngRaw: unknown,
): { ok: true; home: ProfileHomeLocation | null } | { ok: false; error: string } {
  const label = String(labelRaw ?? "").trim();
  const coords = parseOptionalCoordinates(latRaw, lngRaw);
  if (!coords.ok) {
    return coords;
  }
  if (!label && !coords.coordinates) {
    return { ok: true, home: null };
  }
  if (!label && coords.coordinates) {
    return { ok: false, error: "Add a name for home so the group knows where you host." };
  }
  return { ok: true, home: { label, coordinates: coords.coordinates } };
}
