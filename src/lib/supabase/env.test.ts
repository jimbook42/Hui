import { describe, expect, it } from "vitest";

import { getPublicSupabaseConfig, hasPublicSupabaseConfig } from "./env";

describe("getPublicSupabaseConfig", () => {
  it("throws a clear error when configuration is missing", () => {
    expect(() => getPublicSupabaseConfig({})).toThrow(
      /Missing Supabase configuration: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY/,
    );
  });

  it("returns trimmed public configuration", () => {
    const config = getPublicSupabaseConfig({
      NEXT_PUBLIC_SUPABASE_URL: " https://example.supabase.co ",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: " sb_publishable_test ",
    });

    expect(config).toEqual({
      url: "https://example.supabase.co",
      publishableKey: "sb_publishable_test",
    });
  });
});

describe("hasPublicSupabaseConfig", () => {
  it("is false when values are absent", () => {
    expect(hasPublicSupabaseConfig({})).toBe(false);
  });

  it("is true when both values are set", () => {
    expect(
      hasPublicSupabaseConfig({
        NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
      }),
    ).toBe(true);
  });
});
