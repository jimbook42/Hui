"use client";

import type { HostActionState } from "@/app/hosts/actions";
import { AuthForm } from "@/components/auth/auth-form";
import { EventLocationFields } from "@/components/map/event-location-fields";
import {
  hostAcceptPlaceHeading,
  hostPlaceRequiredOnAccept,
} from "@/domain/events/host-place";
import type { EventCoordinates } from "@/domain/events/location";
import {
  hasUsableHomeLocation,
  type ProfileHomeLocation,
} from "@/domain/profile/home-location";
import { cn } from "@/lib/ui/cn";
import { useState } from "react";

type AcceptHostWithPlaceFormProps = {
  action: (prev: HostActionState, formData: FormData) => Promise<HostActionState>;
  eventId: string;
  hostingEnabled: boolean;
  hostPlaceRequired: boolean | null;
  defaultLocation: string | null;
  defaultCoordinates: EventCoordinates | null;
  suggestedHostName: string;
  viewerHomeLocation: ProfileHomeLocation | null;
};

type VenueMode = "home" | "elsewhere";

export function AcceptHostWithPlaceForm({
  action,
  eventId,
  hostingEnabled,
  hostPlaceRequired,
  defaultLocation,
  defaultCoordinates,
  suggestedHostName,
  viewerHomeLocation,
}: AcceptHostWithPlaceFormProps) {
  const needsPlace = hostPlaceRequiredOnAccept(hostingEnabled, hostPlaceRequired);
  const canUseHome = hasUsableHomeLocation(viewerHomeLocation);
  const [venueMode, setVenueMode] = useState<VenueMode>(canUseHome ? "home" : "elsewhere");
  const [location, setLocation] = useState(defaultLocation ?? "");
  const [coordinates, setCoordinates] = useState<EventCoordinates | null>(defaultCoordinates);

  if (!needsPlace) {
    return (
      <AuthForm
        action={action}
        submitLabel="I can host"
        hiddenFields={{ event_id: eventId }}
        refreshOnSuccess
      >
        {null}
      </AuthForm>
    );
  }

  const heading = hostAcceptPlaceHeading(defaultLocation, defaultCoordinates);
  const home = viewerHomeLocation;
  const effectiveLocation =
    venueMode === "home" && home ? home.label : location;
  const effectiveCoordinates =
    venueMode === "home" && home ? home.coordinates : coordinates;

  return (
    <AuthForm
      action={action}
      submitLabel="Confirm hosting"
      hiddenFields={{ event_id: eventId }}
      refreshOnSuccess
    >
      <input type="hidden" name="location" value={effectiveLocation} />
      <input
        type="hidden"
        name="location_lat"
        value={effectiveCoordinates ? String(effectiveCoordinates.lat) : ""}
      />
      <input
        type="hidden"
        name="location_lng"
        value={effectiveCoordinates ? String(effectiveCoordinates.lng) : ""}
      />
      <p className="text-sm font-semibold text-foreground">{heading}</p>
      <p className="mt-1 text-sm text-muted-foreground">
        {suggestedHostName}, you are down to host — confirm where this hui happens before we lock it
        in.
      </p>

      {canUseHome ? (
        <fieldset className="mt-4 space-y-2">
          <legend className="text-sm font-extrabold text-foreground">Where will you host?</legend>
          <div className="grid grid-cols-1 gap-2">
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
                    onChange={() => setVenueMode(value)}
                  />
                  {label}
                </label>
              );
            })}
          </div>
          {venueMode === "home" && home ? (
            <p className="text-xs font-semibold text-muted-foreground">
              Using {home.label}
              {home.coordinates ? " (pinned on the map)" : ""}. You can switch to somewhere else to
              change it.
            </p>
          ) : null}
        </fieldset>
      ) : null}

      {venueMode === "elsewhere" || !canUseHome ? (
        <div className="mt-4">
          <EventLocationFields
            location={location}
            onLocationChange={setLocation}
            coordinates={coordinates}
            onCoordinatesChange={setCoordinates}
            locationLabel="Place for this hui"
            searchLabel="Search for an address"
            helperText="Add a written place, search, or pin the map. Save a home address in Profile to use “At my home” next time."
            defaultMapOpen
          />
        </div>
      ) : null}
    </AuthForm>
  );
}
