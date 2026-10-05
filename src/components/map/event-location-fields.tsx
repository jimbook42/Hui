"use client";

import { AddressSearchField } from "@/components/map/address-search-field";
import { LocationPicker } from "@/components/map/location-picker";
import type { EventCoordinates } from "@/domain/events/location";

type EventLocationFieldsProps = {
  location: string;
  onLocationChange: (value: string) => void;
  coordinates: EventCoordinates | null;
  onCoordinatesChange: (value: EventCoordinates | null) => void;
  locationLabel?: string;
  searchLabel?: string;
  helperText?: string;
  defaultMapOpen?: boolean;
};

export function EventLocationFields({
  location,
  onLocationChange,
  coordinates,
  onCoordinatesChange,
  locationLabel = "Place",
  searchLabel = "Search for an address",
  helperText,
  defaultMapOpen = false,
}: EventLocationFieldsProps) {
  return (
    <div className="space-y-4">
      <AddressSearchField
        label={searchLabel}
        value={location}
        proximityCoordinates={coordinates}
        onPlaceChange={(label, nextCoordinates) => {
          onLocationChange(label);
          onCoordinatesChange(nextCoordinates);
        }}
      />
      <label className="hui-label">
        <span>{locationLabel}</span>
        <input
          className="hui-input"
          value={location}
          placeholder="e.g. Central Park picnic area"
          onChange={(event) => onLocationChange(event.target.value)}
        />
      </label>
      {helperText ? (
        <p className="text-xs font-semibold text-muted-foreground">{helperText}</p>
      ) : null}
      <LocationPicker
        value={coordinates}
        placeLabel={location.trim() || null}
        onChange={onCoordinatesChange}
        defaultOpen={defaultMapOpen || coordinates !== null || location.trim().length > 0}
      />
    </div>
  );
}
