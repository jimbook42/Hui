"use client";

import { useState } from "react";

import { EventLocationFields } from "@/components/map/event-location-fields";
import type { EventCoordinates } from "@/domain/events/location";
import {
  hasUsableHomeLocation,
  type ProfileHomeLocation,
} from "@/domain/profile/home-location";
import { cn } from "@/lib/ui/cn";

type VenueMode = "home" | "elsewhere";

type HostVenueLocationFieldsProps = {
  defaultLocation: string | null;
  defaultCoordinates: EventCoordinates | null;
  viewerHomeLocation: ProfileHomeLocation | null;
  location: string;
  onLocationChange: (value: string) => void;
  coordinates: EventCoordinates | null;
  onCoordinatesChange: (value: EventCoordinates | null) => void;
  locationLabel?: string;
  searchLabel?: string;
  helperText?: string;
  defaultMapOpen?: boolean;
};

function initialVenueMode(
  home: ProfileHomeLocation | null,
  defaultLocation: string | null,
  defaultCoordinates: EventCoordinates | null,
): VenueMode {
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

/**
 * Host place entry with optional saved-home path (no address search when "At my home" is selected).
 */
export function HostVenueLocationFields({
  defaultLocation,
  defaultCoordinates,
  viewerHomeLocation,
  location,
  onLocationChange,
  coordinates,
  onCoordinatesChange,
  locationLabel = "Confirmed place",
  searchLabel = "Search for an address",
  helperText,
  defaultMapOpen,
}: HostVenueLocationFieldsProps) {
  const canUseHome = hasUsableHomeLocation(viewerHomeLocation);
  const home = viewerHomeLocation;
  const [venueMode, setVenueMode] = useState<VenueMode>(() =>
    initialVenueMode(home, defaultLocation, defaultCoordinates),
  );

  function selectVenueMode(next: VenueMode) {
    setVenueMode(next);
    if (next === "home" && home) {
      onLocationChange(home.label);
      onCoordinatesChange(home.coordinates);
    }
  }

  return (
    <div className="space-y-4">
      {canUseHome ? (
        <fieldset className="space-y-2">
          <legend className="text-sm font-extrabold text-foreground">Where will you host?</legend>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {(
              [
                ["home", "At my home"],
                ["elsewhere", "Somewhere else"],
              ] as const
            ).map(([value, label]) => {
              const selected = venueMode === value;
              return (
                <label
                  key={value}
                  className={cn(
                    "hui-focus-ring flex min-h-12 cursor-pointer items-center justify-center rounded-hui-lg px-3 py-3 text-sm font-extrabold",
                    selected
                      ? "border-2 border-primary bg-sage-soft text-foreground"
                      : "border border-transparent bg-muted text-foreground",
                  )}
                >
                  <input
                    type="radio"
                    name="venue_mode_ui"
                    className="sr-only"
                    checked={selected}
                    onChange={() => selectVenueMode(value)}
                  />
                  {label}
                </label>
              );
            })}
          </div>
          {venueMode === "home" && home ? (
            <p className="text-xs font-semibold text-muted-foreground">
              Using {home.label}
              {home.coordinates ? " (pinned on the map)" : ""}. Switch to somewhere else to search
              for a different place.
            </p>
          ) : null}
        </fieldset>
      ) : null}

      {venueMode === "elsewhere" || !canUseHome ? (
        <EventLocationFields
          location={location}
          onLocationChange={onLocationChange}
          coordinates={coordinates}
          onCoordinatesChange={onCoordinatesChange}
          locationLabel={locationLabel}
          searchLabel={searchLabel}
          helperText={
            helperText ??
            "Add a written place, search, or pin the map. Save a home address in Profile to use “At my home”."
          }
          defaultMapOpen={defaultMapOpen}
        />
      ) : null}
    </div>
  );
}
