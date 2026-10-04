"use client";

import { useCallback, useState } from "react";

import { PinIcon } from "@/components/hui/icons";
import { MapSkeleton, MapUnavailable, useLazyMapCanvas } from "@/components/map/event-map";
import type { MapCanvasApi } from "@/components/map/maplibre-canvas";
import { PendingButton } from "@/components/ui/pending-button";
import { roundCoordinate, type EventCoordinates } from "@/domain/events/location";
import { PICKER_FOCUS_ZOOM, getMapConfig } from "@/lib/maps/config";

type LocationPickerProps = {
  value: EventCoordinates | null;
  onChange: (value: EventCoordinates | null) => void;
  /** Written place, used for the map's accessible name. */
  placeLabel?: string | null;
  /** Start with the map already open (e.g. when editing an event that has a pin). */
  defaultOpen?: boolean;
};

function normalise(value: EventCoordinates): EventCoordinates {
  return { lat: roundCoordinate(value.lat), lng: roundCoordinate(value.lng) };
}

/**
 * Optional "pin it on the map" control. The pin is stored as Hui's own latitude/longitude; the
 * map provider is only used to show tiles. Everything here is explicit and user-initiated —
 * Hui never reads the device location unless the user taps "Use my location", and does not store it
 * beyond the pin they choose to keep.
 */
export function LocationPicker({ value, onChange, placeLabel, defaultOpen = false }: LocationPickerProps) {
  const [open, setOpen] = useState(defaultOpen || value !== null);
  const [api, setApi] = useState<MapCanvasApi | null>(null);
  const [locating, setLocating] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const { containerRef, Canvas, phase, setPhase } = useLazyMapCanvas(open);
  const mapsEnabled = getMapConfig().enabled;
  const canLocate = typeof navigator !== "undefined" && "geolocation" in navigator;

  const handlePick = useCallback(
    (next: EventCoordinates) => {
      setNotice(null);
      onChange(normalise(next));
    },
    [onChange],
  );

  function locateMe() {
    if (!canLocate) {
      return;
    }
    setLocating(true);
    setNotice(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        const next = normalise({ lat: position.coords.latitude, lng: position.coords.longitude });
        onChange(next);
        api?.flyTo(next, PICKER_FOCUS_ZOOM);
      },
      () => {
        setLocating(false);
        setNotice("Couldn\u2019t get your location. Tap the map to place the pin instead.");
      },
      { enableHighAccuracy: false, maximumAge: 60_000, timeout: 10_000 },
    );
  }

  function pinMiddle() {
    if (!api) {
      return;
    }
    setNotice(null);
    onChange(normalise(api.getCenter()));
  }

  if (!mapsEnabled) {
    return null;
  }

  if (!open) {
    return (
      <div>
        <PendingButton type="button" variant="soft" size="touch" onClick={() => setOpen(true)}>
          <span className="inline-flex items-center gap-2">
            <PinIcon size={18} />
            Pin it on the map
          </span>
        </PendingButton>
        <p className="mt-2 text-xs font-semibold text-muted-foreground">
          Optional. Lets everyone see the spot on a map. The written place stays the main detail.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="hui-type-label text-muted-foreground">Pin on the map</p>
        <p className="text-xs font-bold text-muted-foreground" role="status">
          {value ? "Pin placed" : "No pin yet"}
        </p>
      </div>

      <div
        ref={containerRef}
        className="relative h-64 overflow-hidden rounded-hui-xl bg-sage-soft hui-shadow-md"
      >
        {phase === "unavailable" ? (
          <MapUnavailable message="The map isn\u2019t available right now. You can still propose without a pin." />
        ) : (
          <>
            {!api ? <MapSkeleton /> : null}
            {Canvas ? (
              <Canvas
                coordinates={value}
                mode="pick"
                ariaLabel={placeLabel ? `Map to pin ${placeLabel}` : "Map to pin the place"}
                onPick={handlePick}
                onReady={setApi}
                onUnavailable={() => setPhase("unavailable")}
              />
            ) : null}
          </>
        )}
      </div>

      <p className="text-xs font-semibold text-muted-foreground">
        Tap the map to drop a pin, then drag it to fine-tune. Use two fingers to move the map.
      </p>

      <div className="flex flex-wrap gap-2">
        {canLocate ? (
          <PendingButton
            type="button"
            variant="soft"
            size="sm"
            disabled={locating || !api}
            pendingLabel="Finding you…"
            onClick={locateMe}
          >
            {locating ? "Finding you…" : "Use my location"}
          </PendingButton>
        ) : null}
        <PendingButton type="button" variant="soft" size="sm" disabled={!api} onClick={pinMiddle}>
          Pin the middle of the map
        </PendingButton>
        {value ? (
          <PendingButton
            type="button"
            variant="soft"
            size="sm"
            onClick={() => {
              onChange(null);
              setNotice(null);
            }}
          >
            Remove pin
          </PendingButton>
        ) : null}
      </div>

      {notice ? (
        <p className="hui-message-note" role="status">
          {notice}
        </p>
      ) : null}
    </div>
  );
}
