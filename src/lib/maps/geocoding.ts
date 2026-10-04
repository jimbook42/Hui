/**
 * Geocoding / address-search service boundary (HUI-026U.3).
 *
 * Hui does not currently search addresses: events store a place name plus an optional pin that the
 * proposer drops on the map. This file only defines the seam so a geocoding provider can be added
 * later WITHOUT touching the event model or UI contracts.
 *
 * Do not implement this against the public Nominatim instance (strict usage policy, not for
 * autocomplete, not for commercial apps) or tile.openstreetmap.org. A real implementation should be a
 * server-side adapter (so API keys stay private and results can be cached/rate-limited) for a provider
 * whose commercial terms Hui has reviewed — e.g. a paid geocoding API or a self-hosted
 * Pelias/Photon/Nominatim.
 */

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

/** No geocoding provider is configured in this release. */
export function getGeocodingProvider(): GeocodingProvider | null {
  return null;
}
