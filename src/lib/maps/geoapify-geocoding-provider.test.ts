import { afterEach, describe, expect, it, vi } from "vitest";



import { GeoapifyGeocodingProvider } from "./geoapify-geocoding-provider";



describe("GeoapifyGeocodingProvider", () => {

  afterEach(() => {

    vi.unstubAllGlobals();

  });



  it("maps Geoapify autocomplete JSON to GeocodeResult with global country bias", async () => {

    const fetchMock = vi.fn().mockResolvedValue({

      ok: true,

      json: async () => ({

        results: [

          {

            formatted: "12 Example St, Wellington 6011, New Zealand",

            lat: -41.2865,

            lon: 174.7762,

          },

        ],

      }),

    });

    vi.stubGlobal("fetch", fetchMock);



    const provider = new GeoapifyGeocodingProvider("test-key");

    const results = await provider.search("12 Example Wellington", {

      proximity: { lat: -41.29, lng: 174.78 },

      limit: 3,

    });



    expect(results).toEqual([

      { label: "12 Example St, Wellington 6011, New Zealand", lat: -41.2865, lng: 174.7762 },

    ]);



    const calledUrl = new URL(fetchMock.mock.calls[0][0] as string);

    expect(calledUrl.pathname).toBe("/v1/geocode/autocomplete");

    expect(calledUrl.searchParams.get("text")).toBe("12 Example Wellington");

    expect(calledUrl.searchParams.get("apiKey")).toBe("test-key");

    expect(calledUrl.searchParams.get("limit")).toBe("3");

    expect(calledUrl.searchParams.getAll("bias")).toEqual(["countrycode:auto", "proximity:174.78,-41.29"]);

    expect(calledUrl.searchParams.get("filter")).toBeNull();

  });



  it("applies country filter only when countryFilter is explicitly set", async () => {

    const fetchMock = vi.fn().mockResolvedValue({

      ok: true,

      json: async () => ({ results: [] }),

    });

    vi.stubGlobal("fetch", fetchMock);



    const provider = new GeoapifyGeocodingProvider("test-key");

    await provider.search("query", { countryFilter: "nz" });



    const calledUrl = new URL(fetchMock.mock.calls[0][0] as string);

    expect(calledUrl.searchParams.getAll("bias")).toEqual(["countrycode:auto"]);

    expect(calledUrl.searchParams.get("filter")).toBe("countrycode:nz");

  });



  it("returns an empty list on HTTP errors", async () => {

    vi.stubGlobal(

      "fetch",

      vi.fn().mockResolvedValue({

        ok: false,

        status: 403,

      }),

    );



    const provider = new GeoapifyGeocodingProvider("test-key");

    await expect(provider.search("query")).resolves.toEqual([]);

  });

});


