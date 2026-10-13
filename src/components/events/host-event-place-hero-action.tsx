"use client";

import { useState } from "react";

import { updateEventAction } from "@/app/events/actions";
import { HostEventLocationForm } from "@/components/events/host-event-location-form";
import { HuiButton } from "@/components/hui/hui-button";
import type { EventCoordinates } from "@/domain/events/location";
import type { ProfileHomeLocation } from "@/domain/profile/home-location";

type HostEventPlaceHeroActionProps = {
  eventId: string;
  defaultTitle: string;
  defaultNotes: string | null;
  defaultLocation: string | null;
  defaultCoordinates: EventCoordinates | null;
  viewerHomeLocation: ProfileHomeLocation | null;
  hasPlace: boolean;
};

export function HostEventPlaceHeroAction({
  eventId,
  defaultTitle,
  defaultNotes,
  defaultLocation,
  defaultCoordinates,
  viewerHomeLocation,
  hasPlace,
}: HostEventPlaceHeroActionProps) {
  const [open, setOpen] = useState(!hasPlace);

  return (
    <div className="rounded-hui-lg border border-border/70 bg-muted/50 px-4 py-3">
      <p className="text-sm font-extrabold text-foreground">
        {hasPlace ? "You are hosting this hui" : "You are hosting — set the place"}
      </p>
      <p className="mt-0.5 text-sm font-semibold text-muted-foreground">
        {hasPlace
          ? "The group sees the place below. Update it here if plans change."
          : "Confirm where this hui happens so everyone knows where to go."}
      </p>
      {open ? (
        <div className="mt-4">
          <HostEventLocationForm
            action={updateEventAction}
            eventId={eventId}
            defaultTitle={defaultTitle}
            defaultNotes={defaultNotes}
            defaultLocation={defaultLocation}
            defaultCoordinates={defaultCoordinates}
            viewerHomeLocation={viewerHomeLocation}
            submitLabel={hasPlace ? "Save place" : "Set the place"}
            compact
          />
          {hasPlace ? (
            <HuiButton
              type="button"
              variant="ghost"
              size="sm"
              className="mt-2"
              onClick={() => setOpen(false)}
            >
              Done
            </HuiButton>
          ) : null}
        </div>
      ) : (
        <HuiButton
          type="button"
          variant="secondary"
          size="sm"
          className="mt-3"
          onClick={() => setOpen(true)}
        >
          Change place
        </HuiButton>
      )}
    </div>
  );
}
