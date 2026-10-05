"use client";

import type { HostActionState } from "@/app/hosts/actions";
import { AuthForm } from "@/components/auth/auth-form";
import { EventLocationFields } from "@/components/map/event-location-fields";
import {
  hostAcceptPlaceHeading,
  hostPlaceRequiredOnAccept,
} from "@/domain/events/host-place";
import type { EventCoordinates } from "@/domain/events/location";
import { useState } from "react";

type AcceptHostWithPlaceFormProps = {
  action: (prev: HostActionState, formData: FormData) => Promise<HostActionState>;
  eventId: string;
  hostingEnabled: boolean;
  hostPlaceRequired: boolean | null;
  defaultLocation: string | null;
  defaultCoordinates: EventCoordinates | null;
  suggestedHostName: string;
};

export function AcceptHostWithPlaceForm({
  action,
  eventId,
  hostingEnabled,
  hostPlaceRequired,
  defaultLocation,
  defaultCoordinates,
  suggestedHostName,
}: AcceptHostWithPlaceFormProps) {
  const needsPlace = hostPlaceRequiredOnAccept(hostingEnabled, hostPlaceRequired);
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

  return (
    <AuthForm
      action={action}
      submitLabel="Confirm hosting"
      hiddenFields={{ event_id: eventId }}
      refreshOnSuccess
    >
      <input type="hidden" name="location" value={location} />
      <input type="hidden" name="location_lat" value={coordinates ? String(coordinates.lat) : ""} />
      <input type="hidden" name="location_lng" value={coordinates ? String(coordinates.lng) : ""} />
      <p className="text-sm font-semibold text-foreground">{heading}</p>
      <p className="mt-1 text-sm text-muted-foreground">
        {suggestedHostName}, you are down to host — confirm where this hui happens before we lock it
        in.
      </p>
      <div className="mt-4">
        <EventLocationFields
          location={location}
          onLocationChange={setLocation}
          coordinates={coordinates}
          onCoordinatesChange={setCoordinates}
          locationLabel="Place for this hui"
          searchLabel="Search for an address"
          helperText="Add a written place, search, or pin the map. Existing details stay unless you change them."
          defaultMapOpen
        />
      </div>
    </AuthForm>
  );
}
