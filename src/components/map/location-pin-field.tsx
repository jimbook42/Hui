"use client";

import { useState } from "react";

import { LocationPicker } from "@/components/map/location-picker";
import type { EventCoordinates } from "@/domain/events/location";

type LocationPinFieldProps = {
  defaultValue?: EventCoordinates | null;
  placeLabel?: string | null;
};

/**
 * Form-friendly wrapper around `LocationPicker`: submits `location_lat` / `location_lng`
 * (both blank when there is no pin, which clears an existing one).
 */
export function LocationPinField({ defaultValue = null, placeLabel }: LocationPinFieldProps) {
  const [value, setValue] = useState<EventCoordinates | null>(defaultValue);
  return (
    <div>
      <input type="hidden" name="location_lat" value={value ? String(value.lat) : ""} />
      <input type="hidden" name="location_lng" value={value ? String(value.lng) : ""} />
      <LocationPicker value={value} onChange={setValue} placeLabel={placeLabel} />
    </div>
  );
}
