"use client";

import { useState } from "react";

import { updateHomeLocationAction } from "@/app/profile/actions";
import { AuthForm } from "@/components/auth/auth-form";
import { EventLocationFields } from "@/components/map/event-location-fields";
import type { ProfileHomeLocation } from "@/domain/profile/home-location";
import type { EventCoordinates } from "@/domain/events/location";

type HomeLocationSectionProps = {
  home: ProfileHomeLocation | null;
  intro?: string;
};

export function HomeLocationSection({ home, intro }: HomeLocationSectionProps) {
  const [location, setLocation] = useState(home?.label ?? "");
  const [coordinates, setCoordinates] = useState<EventCoordinates | null>(home?.coordinates ?? null);

  return (
    <div className="space-y-4">
      {intro ? <p className="text-sm text-muted-foreground">{intro}</p> : null}
      <AuthForm action={updateHomeLocationAction} submitLabel="Save home" refreshOnSuccess>
        <input type="hidden" name="home_location_label" value={location} />
        <input
          type="hidden"
          name="home_location_lat"
          value={coordinates ? String(coordinates.lat) : ""}
        />
        <input
          type="hidden"
          name="home_location_lng"
          value={coordinates ? String(coordinates.lng) : ""}
        />
        <EventLocationFields
          location={location}
          onLocationChange={setLocation}
          coordinates={coordinates}
          onCoordinatesChange={setCoordinates}
          locationLabel="Home address"
          searchLabel="Search for your home"
          helperText="Only people in groups you host for will see this when you choose “At my home”."
        />
      </AuthForm>
    </div>
  );
}
