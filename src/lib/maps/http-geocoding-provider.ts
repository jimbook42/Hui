import type { GeocodeResult, GeocodeSearchOptions, GeocodingProvider } from "./geocoding";

/**
 * Adapter for a server-side geocoding HTTP API you operate (not public Nominatim).
 *
 * Configure:
 *   HUI_GEOCODING_PROVIDER=http
 *   HUI_GEOCODING_HTTP_URL=https://your-geocoder.example/search
 *   HUI_GEOCODING_HTTP_KEY=optional-bearer-token
 *
 * Expected JSON response: `{ "results": [ { "label": string, "lat": number, "lng": number } ] }`
 */
export class HttpGeocodingProvider implements GeocodingProvider {
  readonly id = "http";

  constructor(
    private readonly searchUrl: string,
    private readonly apiKey: string | null,
  ) {}

  async search(query: string, options?: GeocodeSearchOptions): Promise<GeocodeResult[]> {
    const url = new URL(this.searchUrl);
    url.searchParams.set("q", query);
    if (options?.countryFilter) {
      url.searchParams.set("country", options.countryFilter);
    }
    if (options?.limit) {
      url.searchParams.set("limit", String(options.limit));
    }

    const headers: Record<string, string> = { Accept: "application/json" };
    if (this.apiKey) {
      headers.Authorization = `Bearer ${this.apiKey}`;
    }

    const response = await fetch(url, {
      method: "GET",
      headers,
      signal: options?.signal,
      next: { revalidate: 300 },
    });

    if (!response.ok) {
      return [];
    }

    const body = (await response.json()) as { results?: unknown };
    if (!Array.isArray(body.results)) {
      return [];
    }

    const limit = options?.limit ?? 5;
    const parsed: GeocodeResult[] = [];
    for (const row of body.results) {
      if (!row || typeof row !== "object") {
        continue;
      }
      const label = (row as { label?: unknown }).label;
      const lat = (row as { lat?: unknown }).lat;
      const lng = (row as { lng?: unknown }).lng;
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
