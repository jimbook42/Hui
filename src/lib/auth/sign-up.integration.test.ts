import { randomUUID } from "node:crypto";

import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import { getPublicSupabaseConfig, hasPublicSupabaseConfig } from "@/lib/supabase/env";

function canRunSignUpIntegration(): boolean {
  const base = process.env.E2E_TEST_EMAIL?.trim();
  return hasPublicSupabaseConfig() && Boolean(base?.includes("@"));
}

function uniqueSignUpEmail(): string {
  const base = process.env.E2E_TEST_EMAIL!.trim();
  const [local, domain] = base.split("@");
  return `${local}+hui006-${randomUUID().slice(0, 8)}@${domain}`;
}

describe("Supabase sign-up integration", () => {
  it.skipIf(!canRunSignUpIntegration())(
    "creates an auth user via email/password sign-up",
    async () => {
      const { url, publishableKey } = getPublicSupabaseConfig();
      const client = createClient(url, publishableKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const email = uniqueSignUpEmail();
      const password = `HuiTest-${randomUUID()}`;
      const displayName = "Integration User";

      const { data, error } = await client.auth.signUp({
        email,
        password,
        options: { data: { display_name: displayName } },
      });

      expect(error).toBeNull();
      expect(data.user?.id).toBeTruthy();
    },
    30_000,
  );
});
