import { describe, expect, it, vi } from "vitest";

import {
  fetchMyHomeLocation,
  isMissingPostgrestRpc,
} from "./home-location-query";

describe("isMissingPostgrestRpc", () => {
  it("detects PostgREST missing-function errors", () => {
    expect(isMissingPostgrestRpc({ code: "PGRST202", message: "x" })).toBe(true);
    expect(
      isMissingPostgrestRpc({
        code: "42883",
        message: 'function public.my_home_location() does not exist',
      }),
    ).toBe(true);
  });

  it("does not treat other errors as missing RPC", () => {
    expect(isMissingPostgrestRpc({ code: "42501", message: "permission denied" })).toBe(
      false,
    );
  });
});

describe("fetchMyHomeLocation", () => {
  it("uses profile columns when my_home_location is not deployed", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { code: "PGRST202", message: "Could not find the function" },
    });
    const from = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: {
              home_location_label: "Fallback Rd",
              home_location_lat: -36.8,
              home_location_lng: 174.7,
            },
            error: null,
          }),
        }),
      }),
    });
    const supabase = { rpc, from } as never;

    const home = await fetchMyHomeLocation(supabase, "user-1");
    expect(home).toEqual({
      label: "Fallback Rd",
      coordinates: { lat: -36.8, lng: 174.7 },
    });
    expect(from).toHaveBeenCalledWith("profiles");
  });

  it("prefers my_home_location when the RPC succeeds", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        home_location_label: "RPC St",
        home_location_lat: -41,
        home_location_lng: 175,
      },
      error: null,
    });
    const from = vi.fn();
    const supabase = { rpc, from } as never;

    const home = await fetchMyHomeLocation(supabase, "user-1");
    expect(home?.label).toBe("RPC St");
    expect(from).not.toHaveBeenCalled();
  });
});
