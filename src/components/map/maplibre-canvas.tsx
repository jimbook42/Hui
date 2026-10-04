"use client";

import {
  AttributionControl,
  Map as MapLibreMap,
  Marker,
  NavigationControl,
  setWorkerUrl,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef } from "react";

import type { EventCoordinates } from "@/domain/events/location";
import {
  EVENT_MAP_ZOOM,
  PICKER_DEFAULT_CENTER,
  PICKER_DEFAULT_ZOOM,
  PICKER_FOCUS_ZOOM,
  getMapConfig,
  mapStyleFor,
  type MapTheme,
} from "@/lib/maps/config";
import { MAPLIBRE_WORKER_URL } from "@/lib/maps/worker";
import { cn } from "@/lib/ui/cn";

/**
 * The only module that touches MapLibre GL JS. It is always loaded through a dynamic import
 * (see `event-map.tsx`), so the library never lands in the initial event-page bundle.
 */

export type MapCanvasApi = {
  /** Centre of the current viewport. */
  getCenter: () => EventCoordinates;
  /** Smoothly move to a coordinate. */
  flyTo: (coordinates: EventCoordinates, zoom?: number) => void;
};

type MapCanvasProps = {
  coordinates: EventCoordinates | null;
  /** `view` shows one fixed place; `pick` lets the user place/drag a pin. */
  mode: "view" | "pick";
  ariaLabel: string;
  className?: string;
  onPick?: (coordinates: EventCoordinates) => void;
  /** Called once the style has loaded and the map is interactive. */
  onReady?: (api: MapCanvasApi) => void;
  /** Called when the map cannot be shown (no WebGL, style/tile provider unreachable). */
  onUnavailable?: (reason: string) => void;
};

let workerConfigured = false;
function configureWorkerOnce() {
  if (workerConfigured) {
    return;
  }
  setWorkerUrl(MAPLIBRE_WORKER_URL);
  workerConfigured = true;
}

function currentTheme(): MapTheme {
  return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
}

/** Hui-styled pin: brand-coloured teardrop with a ring pulse (pulse disabled for reduced motion). */
function createPinElement(): HTMLElement {
  const el = document.createElement("div");
  el.className = "hui-map-pin";
  el.setAttribute("aria-hidden", "true");
  el.innerHTML = `
    <span class="hui-map-pin-pulse"></span>
    <svg viewBox="0 0 40 52" width="40" height="52" focusable="false">
      <path class="hui-map-pin-body" d="M20 50 C 8 36, 3 28, 3 19 A 17 17 0 1 1 37 19 C 37 28, 32 36, 20 50 Z" />
      <circle class="hui-map-pin-dot" cx="20" cy="19" r="6.5" />
    </svg>`;
  return el;
}

const ROAD_LAYER = /^highway_(path|minor|major_inner|major_subtle|motorway_inner|motorway_subtle|motorway_bridge_inner)$/;
const GREEN_LAYERS = ["park", "landuse_park", "landcover_wood", "landuse_residential"];

/**
 * Re-colour the provider's neutral base style with Hui's map tokens so the map feels like part of
 * the product in both themes. Purely cosmetic and defensive: unknown layers are skipped, so a
 * different provider style still works untouched.
 */
function applyHuiTint(map: MapLibreMap) {
  const css = getComputedStyle(document.documentElement);
  const token = (name: string) => css.getPropertyValue(name).trim();
  const set = (layerId: string, property: string, value: string) => {
    if (!value || !map.getLayer(layerId)) {
      return;
    }
    try {
      // Style layers are provider-defined, so the property names are not statically known.
      (map.setPaintProperty as (id: string, name: string, paint: unknown) => void).call(
        map,
        layerId,
        property,
        value,
      );
    } catch {
      // Style differs from the expected OpenMapTiles layout; leave the layer as the provider drew it.
    }
  };

  set("background", "background-color", token("--map-land"));
  set("water", "fill-color", token("--map-water"));
  for (const id of GREEN_LAYERS) {
    set(id, "fill-color", token("--map-park"));
  }
  set("building", "fill-color", token("--map-block"));
  set("building", "fill-outline-color", token("--map-block"));
  const layers = map.getStyle()?.layers ?? [];
  for (const layer of layers) {
    if (layer.type === "line" && ROAD_LAYER.test(layer.id)) {
      set(layer.id, "line-color", token("--map-road"));
    }
  }
}

export default function MapLibreCanvas({
  coordinates,
  mode,
  ariaLabel,
  className,
  onPick,
  onReady,
  onUnavailable,
}: MapCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markerRef = useRef<Marker | null>(null);
  const callbacks = useRef({ onPick, onReady, onUnavailable });
  const initialCoordinates = useRef(coordinates);

  useEffect(() => {
    callbacks.current = { onPick, onReady, onUnavailable };
  });

  // Create the map once.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }
    const config = getMapConfig();
    if (!config.enabled) {
      callbacks.current.onUnavailable?.("disabled");
      return;
    }

    let disposed = false;
    let loaded = false;
    let theme = currentTheme();
    const start = initialCoordinates.current;
    const picking = mode === "pick";

    let map: MapLibreMap;
    try {
      configureWorkerOnce();
      map = new MapLibreMap({
        container,
        style: mapStyleFor(config, theme),
        center: start ? [start.lng, start.lat] : PICKER_DEFAULT_CENTER,
        zoom: start ? (picking ? PICKER_FOCUS_ZOOM : EVENT_MAP_ZOOM) : PICKER_DEFAULT_ZOOM,
        minZoom: 2,
        maxZoom: 19,
        // Two-finger pan on touch / ctrl+scroll on desktop, so the map never traps page scrolling.
        cooperativeGestures: true,
        dragRotate: false,
        pitchWithRotate: false,
        attributionControl: false,
        fadeDuration: 150,
      });
    } catch {
      callbacks.current.onUnavailable?.("webgl");
      return;
    }
    mapRef.current = map;

    map.touchZoomRotate.disableRotation();
    map.addControl(new NavigationControl({ showCompass: false, visualizePitch: false }), "top-right");
    // Attribution is required by the data licence (OSM / OpenMapTiles) and is kept visible, not collapsed.
    map.addControl(new AttributionControl({ compact: false }), "bottom-right");

    map.on("load", () => {
      if (disposed) {
        return;
      }
      loaded = true;
      applyHuiTint(map);
      callbacks.current.onReady?.({
        getCenter: () => {
          const center = map.getCenter();
          return { lat: center.lat, lng: center.lng };
        },
        flyTo: (target, zoom) => {
          map.flyTo({
            center: [target.lng, target.lat],
            zoom: zoom ?? Math.max(map.getZoom(), PICKER_FOCUS_ZOOM),
            essential: false,
          });
        },
      });
    });

    map.on("error", (event) => {
      // Before the style is up, any error means the provider or WebGL is unusable.
      // Individual tile errors after load are tolerated (the map keeps working).
      if (!loaded && !disposed) {
        const message = event?.error?.message ?? "style";
        callbacks.current.onUnavailable?.(message);
      }
    });

    if (picking) {
      map.on("click", (event) => {
        callbacks.current.onPick?.({ lat: event.lngLat.lat, lng: event.lngLat.lng });
      });
    }

    // Follow the app theme without a reload.
    const observer = new MutationObserver(() => {
      const nextTheme = currentTheme();
      if (nextTheme === theme || disposed) {
        return;
      }
      theme = nextTheme;
      map.setStyle(mapStyleFor(config, nextTheme));
      map.once("style.load", () => {
        if (!disposed) {
          applyHuiTint(map);
        }
      });
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

    // The map can't render until its container has a size; give up gracefully if it never loads.
    const timeout = window.setTimeout(() => {
      if (!loaded && !disposed) {
        callbacks.current.onUnavailable?.("timeout");
      }
    }, 15_000);

    return () => {
      disposed = true;
      window.clearTimeout(timeout);
      observer.disconnect();
      markerRef.current?.remove();
      markerRef.current = null;
      map.remove();
      mapRef.current = null;
    };
    // The map is created once per mount; later coordinate changes are handled below.
  }, [mode]);

  // Keep the pin in sync with coordinates chosen outside the map (view mode + picker buttons).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !coordinates) {
      if (markerRef.current && !coordinates) {
        markerRef.current.remove();
        markerRef.current = null;
      }
      return;
    }
    if (!markerRef.current) {
      const marker = new Marker({
        element: createPinElement(),
        anchor: "bottom",
        draggable: mode === "pick",
      });
      if (mode === "pick") {
        marker.on("dragend", () => {
          const { lat, lng } = marker.getLngLat();
          callbacks.current.onPick?.({ lat, lng });
        });
      }
      marker.setLngLat([coordinates.lng, coordinates.lat]).addTo(map);
      markerRef.current = marker;
    } else {
      markerRef.current.setLngLat([coordinates.lng, coordinates.lat]);
    }
  }, [coordinates, mode]);

  return (
    <div
      ref={containerRef}
      role="region"
      aria-label={ariaLabel}
      className={cn("hui-map absolute inset-0", className)}
    />
  );
}
