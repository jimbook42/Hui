import { describe, expect, it } from "vitest";
import type { User } from "@supabase/supabase-js";

import { authMethodLabelsForUser } from "./auth-methods";

function userWithIdentities(
  identities: { provider: string }[],
  email = "user@hui.test",
): User {
  return {
    id: "user-1",
    aud: "authenticated",
    role: "authenticated",
    email,
    identities: identities.map((identity, index) => ({
      id: `id-${index}`,
      identity_id: `identity-${index}`,
      user_id: "user-1",
      identity_data: {},
      provider: identity.provider,
      created_at: "2026-01-01T00:00:00.000Z",
      last_sign_in_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    })),
    app_metadata: {},
    user_metadata: {},
    created_at: "2026-01-01T00:00:00.000Z",
  };
}

describe("authMethodLabelsForUser", () => {
  it("lists email and password for email identities", () => {
    expect(
      authMethodLabelsForUser(userWithIdentities([{ provider: "email" }])),
    ).toEqual(["Email and password"]);
  });

  it("lists OAuth providers without exposing technical ids in labels", () => {
    expect(
      authMethodLabelsForUser(
        userWithIdentities([{ provider: "google" }, { provider: "azure" }]),
      ),
    ).toEqual(["Google", "Microsoft"]);
  });

  it("deduplicates repeated providers", () => {
    expect(
      authMethodLabelsForUser(
        userWithIdentities([{ provider: "google" }, { provider: "google" }]),
      ),
    ).toEqual(["Google"]);
  });

  it("falls back to email and password when identities are missing", () => {
    expect(authMethodLabelsForUser(userWithIdentities([]))).toEqual([
      "Email and password",
    ]);
  });

  it("ignores unknown provider ids", () => {
    expect(
      authMethodLabelsForUser(
        userWithIdentities([{ provider: "unknown-sso" }, { provider: "google" }]),
      ),
    ).toEqual(["Google"]);
  });
});
