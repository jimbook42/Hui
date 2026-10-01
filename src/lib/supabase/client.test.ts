import { describe, expect, it } from "vitest";

import { createClient } from "./client";
import { hasPublicSupabaseConfig } from "./env";

const testEnv = {
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
};

describe("createClient", () => {
  it("creates a Supabase client when public configuration is present", () => {
    const previousUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const previousKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

    process.env.NEXT_PUBLIC_SUPABASE_URL = testEnv.NEXT_PUBLIC_SUPABASE_URL;
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY =
      testEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

    try {
      const client = createClient();
      expect(client).toBeDefined();
      expect(client.auth).toBeDefined();
      expect(client.from).toBeTypeOf("function");
    } finally {
      process.env.NEXT_PUBLIC_SUPABASE_URL = previousUrl;
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = previousKey;
    }
  });
});

describe("supabase connectivity smoke", () => {
  it.skipIf(!hasPublicSupabaseConfig())(
    "initialises against the configured project (auth.getSession)",
    async () => {
      const client = createClient();
      const { error } = await client.auth.getSession();
      expect(error).toBeNull();
    },
  );
});
