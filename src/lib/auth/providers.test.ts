import { describe, expect, it, vi } from "vitest";

import { CANONICAL_USER_ID_FIELD } from "./identity";
import {
  buildOAuthCallbackUrl,
  oauthCallbackFailureReason,
  signInWithOAuthProvider,
  validateOAuthSignInRequest,
} from "./oauth";
import {
  AUTH_OAUTH_PROVIDER_IDS,
  AUTH_PROVIDERS,
  getAuthProvider,
  getEnabledOAuthProviders,
  isEmailAuthEnabled,
} from "./providers";

describe("auth providers", () => {
  it("keeps email/password enabled alongside Google OAuth", () => {
    expect(isEmailAuthEnabled()).toBe(true);
    expect(getEnabledOAuthProviders().map((provider) => provider.id)).toEqual([
      "google",
    ]);
  });

  it("enables only Google among OAuth providers", () => {
    for (const id of AUTH_OAUTH_PROVIDER_IDS) {
      expect(getAuthProvider(id)?.enabled).toBe(id === "google");
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
  it("allows Google when enabled", () => {
    expect(validateOAuthSignInRequest("google")).toEqual({ provider: "google" });
  });

  it("rejects disabled OAuth providers", () => {
    expect(() => validateOAuthSignInRequest("apple")).toThrow(/not enabled/);
    expect(() => validateOAuthSignInRequest("facebook")).toThrow(/not enabled/);
    expect(() => validateOAuthSignInRequest("azure")).toThrow(/not enabled/);
  });
});

describe("buildOAuthCallbackUrl", () => {
  it("targets the Hui auth callback with a safe next path", () => {
    expect(
      buildOAuthCallbackUrl("https://hui-seven-gamma.vercel.app", "/dashboard"),
    ).toBe(
      "https://hui-seven-gamma.vercel.app/auth/callback?next=%2Fdashboard",
    );
  });
});

describe("oauthCallbackFailureReason", () => {
  it("treats access_denied as cancellation and other provider errors as failure", () => {
    expect(oauthCallbackFailureReason("access_denied")).toBe("cancelled");
    expect(oauthCallbackFailureReason("server_error")).toBe("failed");
    expect(oauthCallbackFailureReason("temporarily_unavailable")).toBe("failed");
  });
});

describe("signInWithOAuthProvider", () => {
  it("calls Supabase signInWithOAuth for enabled providers", async () => {
    const signInWithOAuth = vi.fn().mockResolvedValue({
      data: { url: "https://accounts.google.com/o/oauth2/v2/auth" },
      error: null,
    });
    const supabase = { auth: { signInWithOAuth } } as never;

    await signInWithOAuthProvider(
      supabase,
      "google",
      "https://hui-seven-gamma.vercel.app/auth/callback?next=%2Fdashboard",
    );

    expect(signInWithOAuth).toHaveBeenCalledWith({
      provider: "google",
      options: {
        redirectTo:
          "https://hui-seven-gamma.vercel.app/auth/callback?next=%2Fdashboard",
      },
    });
  });

  it("does not call Supabase for disabled providers", async () => {
    const signInWithOAuth = vi.fn();
    const supabase = { auth: { signInWithOAuth } } as never;

    await expect(
      signInWithOAuthProvider(supabase, "apple", "https://example.com/auth/callback"),
    ).rejects.toThrow(/not enabled/);
    expect(signInWithOAuth).not.toHaveBeenCalled();
  });
});

describe("canonical identity", () => {
  it("documents Supabase auth user id as the Hui identity source", () => {
    expect(CANONICAL_USER_ID_FIELD).toBe("auth.users.id");
  });
});
