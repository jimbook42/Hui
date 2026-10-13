"use client";

import type { EventActionState } from "@/app/events/actions";
import { AuthForm } from "@/components/auth/auth-form";
import { HostVenueLocationFields } from "@/components/map/host-venue-location-fields";
import { useState } from "react";
import type { EventCoordinates } from "@/domain/events/location";
import type { ProfileHomeLocation } from "@/domain/profile/home-location";

type HostEventLocationFormProps = {
  action: (prev: EventActionState, formData: FormData) => Promise<EventActionState>;
  eventId: string;
  defaultTitle: string;
  defaultNotes: string | null;
  defaultLocation: string | null;
  defaultCoordinates: EventCoordinates | null;
  viewerHomeLocation?: ProfileHomeLocation | null;
  submitLabel?: string;
  compact?: boolean;
};

export function HostEventLocationForm({
  action,
  eventId,
  defaultTitle,
  defaultNotes,
  defaultLocation,
  defaultCoordinates,
  viewerHomeLocation = null,
  submitLabel = "Save place",
  compact = false,
}: HostEventLocationFormProps) {
  const [location, setLocation] = useState(defaultLocation ?? "");
  const [coordinates, setCoordinates] = useState<EventCoordinates | null>(defaultCoordinates);

  return (
    <AuthForm
      action={action}
      submitLabel={submitLabel}
      hiddenFields={{
        event_id: eventId,
        title: defaultTitle,
        notes: defaultNotes ?? "",
      }}
    >
      <input type="hidden" name="location" value={location} />
      <input type="hidden" name="location_lat" value={coordinates ? String(coordinates.lat) : ""} />
      <input type="hidden" name="location_lng" value={coordinates ? String(coordinates.lng) : ""} />
      {!compact ? (
        <p className="text-sm text-muted-foreground">
          As host, you confirm where this hui happens. The group can still see any place the proposer
          suggested.
        </p>
      ) : null}
      <div className={compact ? "" : "mt-4"}>
        <HostVenueLocationFields
          defaultLocation={defaultLocation}
          defaultCoordinates={defaultCoordinates}
          viewerHomeLocation={viewerHomeLocation}
          location={location}
          onLocationChange={setLocation}
          coordinates={coordinates}
          onCoordinatesChange={setCoordinates}
          locationLabel="Confirmed place"
          helperText="Optional. Leave blank if the venue is still being decided."
          defaultMapOpen={coordinates !== null}
        />
      </div>
    </AuthForm>
  );
}
