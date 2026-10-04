/**
 * Geocoding / address-search service boundary (HUI-026U.3 / HUI-026U.4).
 *
 * Address autocomplete uses this seam only — not public Nominatim or tile.openstreetmap.org.
 * Configure via `HUI_GEOCODING_*` env vars; see `docs/MAPS.md`.
 */

import { HttpGeocodingProvider } from "./http-geocoding-provider";

export type GeocodeResult = {
  /** Display line chosen by the provider, e.g. "12 Example St, Wellington". */
  label: string;
  lat: number;
  lng: number;
};

export type GeocodeSearchOptions = {
  /** ISO 3166-1 alpha-2 country bias, e.g. "nz". */
  countryCode?: string;
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
  if (kind === "http") {
    const searchUrl = process.env.HUI_GEOCODING_HTTP_URL?.trim();
    if (searchUrl) {
      cachedProvider = new HttpGeocodingProvider(
        searchUrl,
        process.env.HUI_GEOCODING_HTTP_KEY?.trim() || null,
      );
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

/** @internal test helper */
export function resetGeocodingProviderCacheForTests() {
  cachedProvider = undefined;
}
