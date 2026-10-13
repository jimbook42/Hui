/**
 * Map provider configuration (HUI-026U.3).
 *
 * Hui separates three things on purpose:
 *
 *   Hui event location (lat/lng + place text, stored in our own database)
 *        -> map component (MapLibre GL JS renders vector tiles)
 *        -> provider configuration (this file: which style / tile source to use)
 *        -> tile / map-data provider (replaceable by env vars, no code change)
 *
 * Nothing in the domain model references a provider. Swapping providers means changing the
 * style URLs below (or the env vars) — never the event schema or the map component.
 *
 * The default provider is the OpenFreeMap public instance, chosen for MVP development because it:
 *   - allows commercial use, needs no API key and has no request limits,
 *   - serves OpenMapTiles-schema vector tiles from OpenStreetMap data,
 *   - is fully open source and self-hostable (a production path that keeps the same style URLs).
 * It is donation-funded and offers no SLA, so before real scale Hui should either self-host it or
 * point `NEXT_PUBLIC_MAP_PROVIDER=custom` at a paid/SLA-backed style URL. See docs/ARCHITECTURE.md.
 *
 * Hui deliberately does NOT use tile.openstreetmap.org or public Nominatim.
 */

export type MapProviderId = "openfreemap" | "custom";

export type MapTheme = "light" | "dark";

export type MapEnv = {
  /** "false" disables maps entirely (the event page then shows the address only). */
  enabled?: string;
  /** "openfreemap" (default) or "custom". */
  provider?: string;
  /** Custom provider: MapLibre style JSON URL for light mode. */
  styleLightUrl?: string;
  /** Custom provider: MapLibre style JSON URL for dark mode (falls back to the light style). */
  styleDarkUrl?: string;
  /** Custom provider: optional API key, appended as `?key=` to style URLs that do not include one. */
  apiKey?: string;
};

export type MapConfig = {
  enabled: boolean;
  provider: MapProviderId;
  styles: Record<MapTheme, string>;
  /** Human-readable provider name for diagnostics/docs (attribution comes from the style itself). */
  providerLabel: string;
};

export const OPENFREEMAP_STYLES: Record<MapTheme, string> = {
  light: "https://tiles.openfreemap.org/styles/positron",
  dark: "https://tiles.openfreemap.org/styles/dark",
};

/** Zoom used when focusing a single event location. */
export const EVENT_MAP_ZOOM = 15;
/** Wide, country-scale view for the "pick a spot" map before a pin exists (Aotearoa New Zealand). */
export const PICKER_DEFAULT_CENTER: [number, number] = [172.6, -41.5];
export const PICKER_DEFAULT_ZOOM = 4.2;
/** Zoom applied after "use my location" or when a pin is placed from a wide view. */
export const PICKER_FOCUS_ZOOM = 15;

function withKey(url: string, apiKey: string | undefined): string {
  if (!apiKey) {
    return url;
  }
  try {
    const parsed = new URL(url);
    if (!parsed.searchParams.has("key")) {
      parsed.searchParams.set("key", apiKey);
    }
    return parsed.toString();
  } catch {
    return url;
  }
}

function isHttpsUrl(value: string | undefined): value is string {
  if (!value) {
    return false;
  }
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" || parsed.hostname === "localhost";
  } catch {
    return false;
  }
}

/** Pure resolution of env -> config (unit-tested). */
export function resolveMapConfig(env: MapEnv): MapConfig {
  const disabled = env.enabled?.trim().toLowerCase() === "false";
  const provider: MapProviderId = env.provider?.trim().toLowerCase() === "custom" ? "custom" : "openfreemap";

  if (disabled) {
    return {
      enabled: false,
      provider,
      styles: OPENFREEMAP_STYLES,
      providerLabel: "disabled",
    };
  }

  if (provider === "custom") {
    const light = env.styleLightUrl?.trim();
    const dark = env.styleDarkUrl?.trim();
    // A custom provider without a usable light style is a misconfiguration: disable the map
    // rather than silently falling back to a different provider than the operator intended.
    if (!isHttpsUrl(light)) {
      return {
        enabled: false,
        provider,
        styles: OPENFREEMAP_STYLES,
        providerLabel: "custom (misconfigured)",
      };
    }
    const lightUrl = withKey(light, env.apiKey?.trim());
    const darkUrl = isHttpsUrl(dark) ? withKey(dark, env.apiKey?.trim()) : lightUrl;
    return {
      enabled: true,
      provider,
      styles: { light: lightUrl, dark: darkUrl },
      providerLabel: "custom",
    };
  }

  return {
    enabled: true,
    provider,
    styles: OPENFREEMAP_STYLES,
    providerLabel: "OpenFreeMap",
  };
}

/**
 * Public env must be referenced statically so Next.js can inline it into the client bundle.
 */
export function readMapEnv(): MapEnv {
  return {
    enabled: process.env.NEXT_PUBLIC_MAP_ENABLED,
    provider: process.env.NEXT_PUBLIC_MAP_PROVIDER,
    styleLightUrl: process.env.NEXT_PUBLIC_MAP_STYLE_LIGHT_URL,
    styleDarkUrl: process.env.NEXT_PUBLIC_MAP_STYLE_DARK_URL,
    apiKey: process.env.NEXT_PUBLIC_MAP_API_KEY,
  };
}

export function getMapConfig(): MapConfig {
  return resolveMapConfig(readMapEnv());
}

export function mapStyleFor(config: MapConfig, theme: MapTheme): string {
  return config.styles[theme];
}
