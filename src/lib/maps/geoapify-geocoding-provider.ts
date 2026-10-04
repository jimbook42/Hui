import type { GeocodeResult, GeocodeSearchOptions, GeocodingProvider } from "./geocoding";

const GEOAPIFY_AUTOCOMPLETE_URL = "https://api.geoapify.com/v1/geocode/autocomplete";

type GeoapifyAutocompleteRow = {
  formatted?: unknown;
  lat?: unknown;
  lon?: unknown;
};

type GeoapifyAutocompleteResponse = {
  results?: unknown;
};

/**
 * Production geocoder adapter for Geoapify Address Autocomplete (HUI-026U.4 follow-up).
 *
 * Configure:
 *   HUI_GEOCODING_PROVIDER=geoapify
 *   HUI_GEOCODING_HTTP_KEY=<Geoapify API key>
 *
 * Server-side only; keys must not be exposed to the browser.
 *
 * Global search with local relevance: `countrycode:auto` (IP-derived country bias) plus optional
 * proximity bias when the user has already placed a pin — never a default country filter.
 */
export class GeoapifyGeocodingProvider implements GeocodingProvider {
  readonly id = "geoapify";

  constructor(private readonly apiKey: string) {}

  async search(query: string, options?: GeocodeSearchOptions): Promise<GeocodeResult[]> {
    const url = new URL(GEOAPIFY_AUTOCOMPLETE_URL);
    url.searchParams.set("text", query);
    url.searchParams.set("format", "json");
    url.searchParams.set("apiKey", this.apiKey);
    const limit = options?.limit ?? 5;
    url.searchParams.set("limit", String(limit));

    url.searchParams.append("bias", "countrycode:auto");
    if (options?.proximity) {
      const { lat, lng } = options.proximity;
      url.searchParams.append("bias", `proximity:${lng},${lat}`);
    }
    if (options?.countryFilter) {
      url.searchParams.set("filter", `countrycode:${options.countryFilter.toLowerCase()}`);
    }

    const response = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: options?.signal,
      next: { revalidate: 300 },
    });

    if (!response.ok) {
      return [];
    }

    const body = (await response.json()) as GeoapifyAutocompleteResponse;
    if (!Array.isArray(body.results)) {
      return [];
    }

    const parsed: GeocodeResult[] = [];
    for (const row of body.results) {
      if (!row || typeof row !== "object") {
        continue;
      }
      const item = row as GeoapifyAutocompleteRow;
      const label = item.formatted;
      const lat = item.lat;
      const lng = item.lon;
      if (typeof label !== "string" || typeof lat !== "number" || typeof lng !== "number") {
        continue;
      }
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        continue;
      }
      parsed.push({ label, lat, lng });
      if (parsed.length >= limit) {
        break;
      }
    }
    return parsed;
  }
}
