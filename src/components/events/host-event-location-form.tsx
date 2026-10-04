"use client";

import type { EventActionState } from "@/app/events/actions";
import { AuthForm } from "@/components/auth/auth-form";
import { EventLocationFields } from "@/components/map/event-location-fields";
import { useState } from "react";
import type { EventCoordinates } from "@/domain/events/location";

type HostEventLocationFormProps = {
  action: (prev: EventActionState, formData: FormData) => Promise<EventActionState>;
  eventId: string;
  defaultTitle: string;
  defaultNotes: string | null;
  defaultLocation: string | null;
  defaultCoordinates: EventCoordinates | null;
};

export function HostEventLocationForm({
  action,
  eventId,
  defaultTitle,
  defaultNotes,
  defaultLocation,
  defaultCoordinates,
}: HostEventLocationFormProps) {
  const [location, setLocation] = useState(defaultLocation ?? "");
  const [coordinates, setCoordinates] = useState<EventCoordinates | null>(defaultCoordinates);

  return (
    <AuthForm
      action={action}
      submitLabel="Save place"
      hiddenFields={{
        event_id: eventId,
        title: defaultTitle,
        notes: defaultNotes ?? "",
      }}
    >
      <input type="hidden" name="location" value={location} />
      <input type="hidden" name="location_lat" value={coordinates ? String(coordinates.lat) : ""} />
      <input type="hidden" name="location_lng" value={coordinates ? String(coordinates.lng) : ""} />
      <p className="text-sm text-muted-foreground">
        As host, you confirm where this hui happens. The group can still see any place the proposer
        suggested.
      </p>
      <div className="mt-4">
        <EventLocationFields
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
