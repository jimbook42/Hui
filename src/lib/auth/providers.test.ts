import { describe, expect, it } from "vitest";

import { CANONICAL_USER_ID_FIELD } from "./identity";
import { validateOAuthSignInRequest } from "./oauth";
import {
  AUTH_OAUTH_PROVIDER_IDS,
  AUTH_PROVIDERS,
  getAuthProvider,
  getEnabledOAuthProviders,
  isEmailAuthEnabled,
} from "./providers";

describe("auth providers", () => {
  it("keeps email/password enabled as the only active method", () => {
    expect(isEmailAuthEnabled()).toBe(true);
    expect(getEnabledOAuthProviders()).toEqual([]);
  });

  it("defaults every OAuth provider to disabled", () => {
    for (const id of AUTH_OAUTH_PROVIDER_IDS) {
      expect(getAuthProvider(id)?.enabled).toBe(false);
    }
  });

  it("defines planned OAuth providers with continue labels", () => {
    expect(getAuthProvider("google")?.continueLabel).toBe("Continue with Google");
    expect(getAuthProvider("apple")?.continueLabel).toBe("Continue with Apple");
    expect(getAuthProvider("facebook")?.continueLabel).toBe(
      "Continue with Facebook",
    );
    expect(getAuthProvider("azure")?.continueLabel).toBe(
      "Continue with Microsoft",
    );
  });

  it("maps OAuth providers to Supabase provider ids", () => {
    for (const id of AUTH_OAUTH_PROVIDER_IDS) {
      expect(getAuthProvider(id)?.supabaseOAuthProvider).toBe(id);
    }
  });

  it("lists email and each OAuth provider exactly once", () => {
    const ids = AUTH_PROVIDERS.map((provider) => provider.id);
    expect(ids).toEqual([...AUTH_OAUTH_PROVIDER_IDS, "email"]);
  });
});

describe("validateOAuthSignInRequest", () => {
  it("rejects disabled OAuth providers", () => {
    expect(() => validateOAuthSignInRequest("google")).toThrow(
      /not enabled/,
    );
  });
});

describe("canonical identity", () => {
  it("documents Supabase auth user id as the Hui identity source", () => {
    expect(CANONICAL_USER_ID_FIELD).toBe("auth.users.id");
  });
});
