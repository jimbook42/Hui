/**
 * Geocoding / address-search service boundary (HUI-026U.3 / HUI-026U.4).
 *
 * Address autocomplete uses this seam only — not public Nominatim or tile.openstreetmap.org.
 * Configure via `HUI_GEOCODING_*` env vars; see `docs/ARCHITECTURE.md` and `.env.example`.
 */

import { GeoapifyGeocodingProvider } from "./geoapify-geocoding-provider";
import { HttpGeocodingProvider } from "./http-geocoding-provider";

export type GeocodeResult = {
  /** Display line chosen by the provider, e.g. "12 Example St, Wellington". */
  label: string;
  lat: number;
  lng: number;
};

export type GeocodeProximity = {
  lat: number;
  lng: number;
};

export type GeocodeSearchOptions = {
  /**
   * Optional ISO 3166-1 alpha-2 country **filter** (excludes other countries).
   * Not used by Hui product UI — Geoapify uses `countrycode:auto` bias instead.
   */
  countryFilter?: string;
  /** Prioritise results near this point (Geoapify proximity bias). Does not exclude worldwide results. */
  proximity?: GeocodeProximity;
  limit?: number;
  signal?: AbortSignal;
};

export interface GeocodingProvider {
  readonly id: string;
  search(query: string, options?: GeocodeSearchOptions): Promise<GeocodeResult[]>;
}

let cachedProvider: GeocodingProvider | null | undefined;

/** Returns null when no provider is configured (manual place entry and map pin still work). */
export function getGeocodingProvider(): GeocodingProvider | null {
  if (cachedProvider !== undefined) {
    return cachedProvider;
  }

  const kind = process.env.HUI_GEOCODING_PROVIDER?.trim().toLowerCase();
  const apiKey = process.env.HUI_GEOCODING_HTTP_KEY?.trim() || null;

  if (kind === "geoapify" && apiKey) {
    cachedProvider = new GeoapifyGeocodingProvider(apiKey);
    return cachedProvider;
  }

  if (kind === "http") {
    const searchUrl = process.env.HUI_GEOCODING_HTTP_URL?.trim();
    if (searchUrl) {
      cachedProvider = new HttpGeocodingProvider(searchUrl, apiKey);
      return cachedProvider;
    }
  }

  cachedProvider = null;
  return cachedProvider;
}

export async function searchGeocodeAddresses(
  query: string,
  options?: GeocodeSearchOptions,
): Promise<GeocodeResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < 3) {
    return [];
  }
  const provider = getGeocodingProvider();
  if (!provider) {
    return [];
  }
  return provider.search(trimmed, { limit: 5, ...options });
}

/** Parse optional proximity query params for `/api/geocode`. */
export function parseGeocodeProximityFromSearchParams(
  latRaw: string | null,
  lngRaw: string | null,
): GeocodeProximity | undefined {
  if (latRaw === null || lngRaw === null || latRaw === "" || lngRaw === "") {
    return undefined;
  }
  const lat = Number(latRaw);
  const lng = Number(lngRaw);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return undefined;
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return undefined;
  }
  return { lat, lng };
}

/** @internal test helper */
export function resetGeocodingProviderCacheForTests() {
  cachedProvider = undefined;
}
