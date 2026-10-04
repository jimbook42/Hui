"use client";

import { useEffect, useRef, useState, type ComponentType, type ReactNode } from "react";

import { PinIcon } from "@/components/hui/icons";
import { describeMapLocation, type EventCoordinates } from "@/domain/events/location";
import { getMapConfig } from "@/lib/maps/config";
import { cn } from "@/lib/ui/cn";

import type { MapCanvasApi } from "@/components/map/maplibre-canvas";

type CanvasProps = {
  coordinates: EventCoordinates | null;
  mode: "view" | "pick";
  ariaLabel: string;
  className?: string;
  onPick?: (coordinates: EventCoordinates) => void;
  onReady?: (api: MapCanvasApi) => void;
  onUnavailable?: (reason: string) => void;
};

type CanvasComponent = ComponentType<CanvasProps>;

export type MapPhase = "waiting" | "loading" | "ready" | "unavailable";

/**
 * Lazily load the MapLibre canvas: only once the map area is near the viewport and the browser is idle.
 * The rest of the page (and the written address) never waits for it. Used by the event hero and the
 * location picker.
 */
export function useLazyMapCanvas(active: boolean) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [Canvas, setCanvas] = useState<CanvasComponent | null>(null);
  const [phase, setPhase] = useState<MapPhase>("waiting");
  const startedRef = useRef(false);

  useEffect(() => {
    if (!active || startedRef.current) {
      return;
    }
    const config = getMapConfig();
    if (!config.enabled) {
      // Deferred so the state update is not synchronous inside the effect body.
      const timer = window.setTimeout(() => setPhase("unavailable"), 0);
      return () => window.clearTimeout(timer);
    }

    const element = containerRef.current;
    let cancelled = false;
    let idleHandle: number | null = null;
    let timeoutHandle: number | null = null;
    let observer: IntersectionObserver | null = null;

    const load = () => {
      if (startedRef.current || cancelled) {
        return;
      }
      startedRef.current = true;
      setPhase("loading");
      import("@/components/map/maplibre-canvas")
        .then((module) => {
          if (!cancelled) {
            setCanvas(() => module.default as CanvasComponent);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setPhase("unavailable");
          }
        });
    };

    const whenIdle = () => {
      if (typeof window.requestIdleCallback === "function") {
        idleHandle = window.requestIdleCallback(load, { timeout: 1200 });
      } else {
        timeoutHandle = window.setTimeout(load, 150);
      }
    };

    if (element && typeof IntersectionObserver === "function") {
      observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) {
            observer?.disconnect();
            whenIdle();
          }
        },
        { rootMargin: "240px" },
      );
      observer.observe(element);
    } else {
      whenIdle();
    }

    return () => {
      cancelled = true;
      observer?.disconnect();
      if (idleHandle !== null && typeof window.cancelIdleCallback === "function") {
        window.cancelIdleCallback(idleHandle);
      }
      if (timeoutHandle !== null) {
        window.clearTimeout(timeoutHandle);
      }
    };
  }, [active]);

  return { containerRef, Canvas, phase, setPhase };
}

export function MapSkeleton({ label = "Loading map" }: { label?: string }) {
  return (
    <div
      className="hui-skeleton absolute inset-0 flex items-center justify-center !rounded-none"
      role="status"
      aria-label={label}
    >
      <PinIcon size={28} className="text-muted-foreground opacity-60" />
    </div>
  );
}

export function MapUnavailable({ message }: { message?: string }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-sage-soft px-6 text-center">
      <PinIcon size={26} className="text-accent" />
      <p className="text-sm font-extrabold text-foreground">
        {message ?? "The map isn\u2019t available right now."}
      </p>
    </div>
  );
}

type EventMapProps = {
  coordinates: EventCoordinates;
  /** The written place — always shown by the caller too; used for the map's accessible name. */
  location: string | null;
  className?: string;
  /** Overlay content, e.g. the status pill. */
  children?: ReactNode;
};

/**
 * Interactive, lazily loaded map for one event location. Pan/zoom use cooperative gestures on
 * touch (two fingers) so scrolling the page never gets trapped by the map.
 */
export function EventMap({ coordinates, location, className, children }: EventMapProps) {
  const { containerRef, Canvas, phase, setPhase } = useLazyMapCanvas(true);
  const [mapReady, setMapReady] = useState(false);

  return (
    <div ref={containerRef} className={cn("relative isolate overflow-hidden bg-sage-soft", className)}>
      {phase === "unavailable" ? (
        <MapUnavailable />
      ) : (
        <>
          {!mapReady ? <MapSkeleton /> : null}
          {Canvas ? (
            <Canvas
              coordinates={coordinates}
              mode="view"
              ariaLabel={describeMapLocation(location)}
              onReady={() => setMapReady(true)}
              onUnavailable={() => setPhase("unavailable")}
            />
          ) : null}
        </>
      )}
      {children ? <div className="pointer-events-none absolute inset-0 z-20">{children}</div> : null}
    </div>
  );
}
