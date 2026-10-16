"use client";

import { useSyncExternalStore } from "react";

import { acceptHostProposalAction } from "@/app/hosts/actions";
import { AcceptHostWithPlaceForm } from "@/components/hosts/accept-host-with-place-form";
import { HostSwapRequestForm } from "@/components/hosts/host-swap-request-form";
import { HuiSurface } from "@/components/hui/hui-surface";
import type { EventCoordinates } from "@/domain/events/location";
import type { ProfileHomeLocation } from "@/domain/profile/home-location";
import { isHostPromptDeferred } from "@/lib/events/defer-host-prompt";

type EventHostGentlePromptProps = {
  eventId: string;
  canAcceptHost: boolean;
  canRequestSwap: boolean;
  hostSwapHasReplacement: boolean;
  suggestedHostName: string | null;
  hostingEnabled: boolean;
  hostPlaceRequired: boolean | null;
  eventLocation: string | null;
  eventCoordinates: EventCoordinates | null;
  viewerHomeLocation: ProfileHomeLocation | null;
  gatheringEnded?: boolean;
};

export function EventHostGentlePrompt({
  eventId,
  canAcceptHost,
  canRequestSwap,
  hostSwapHasReplacement,
  suggestedHostName,
  hostingEnabled,
  hostPlaceRequired,
  eventLocation,
  eventCoordinates,
  viewerHomeLocation,
  gatheringEnded = false,
}: EventHostGentlePromptProps) {
  const hidden = useSyncExternalStore(
    () => () => undefined,
    () => isHostPromptDeferred(eventId),
    () => false,
  );

  if (!hostingEnabled || hidden || !suggestedHostName || gatheringEnded) {
    return null;
  }
  if (!canAcceptHost && !canRequestSwap) {
    return null;
  }

  return (
    <HuiSurface tone="subtle" shape="soft" padding="md" className="hui-rise-2" role="status">
      <p className="text-sm font-extrabold text-foreground">Hosting for this hui</p>
      <p className="mt-1 text-sm font-semibold text-muted-foreground">
        Hui suggested you to host. You can accept when you&apos;re ready — no rush right after
        answering.
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        {canAcceptHost ? (
          <AcceptHostWithPlaceForm
            action={acceptHostProposalAction}
            eventId={eventId}
            hostingEnabled={hostingEnabled}
            hostPlaceRequired={hostPlaceRequired}
            defaultLocation={eventLocation}
            defaultCoordinates={eventCoordinates}
            suggestedHostName={suggestedHostName}
            viewerHomeLocation={viewerHomeLocation}
            gatheringEnded={gatheringEnded}
          />
        ) : null}
        {canRequestSwap ? (
          <HostSwapRequestForm eventId={eventId} hasReplacement={hostSwapHasReplacement} />
        ) : null}
      </div>
    </HuiSurface>
  );
}
