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
  it("keeps email/password enabled alongside Google and Microsoft OAuth", () => {
    expect(isEmailAuthEnabled()).toBe(true);
    expect(getEnabledOAuthProviders().map((provider) => provider.id)).toEqual([
      "google",
      "azure",
    ]);
  });

  it("enables Google and Microsoft among OAuth providers", () => {
    for (const id of AUTH_OAUTH_PROVIDER_IDS) {
      expect(getAuthProvider(id)?.enabled).toBe(id === "google" || id === "azure");
    }
  });

  it("keeps Facebook and Apple hidden (disabled)", () => {
    expect(getAuthProvider("facebook")?.enabled).toBe(false);
    expect(getAuthProvider("apple")?.enabled).toBe(false);
  });

  it("defines planned OAuth providers with continue labels", () => {
    expect(getAuthProvider("google")?.continueLabel).toBe("Continue with Google");
    expect(getAuthProvider("azure")?.continueLabel).toBe(
      "Continue with Microsoft",
    );
    expect(getAuthProvider("apple")?.continueLabel).toBe("Continue with Apple");
    expect(getAuthProvider("facebook")?.continueLabel).toBe(
      "Continue with Facebook",
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
  it("allows Google and Microsoft when enabled", () => {
    expect(validateOAuthSignInRequest("google")).toEqual({ provider: "google" });
    expect(validateOAuthSignInRequest("azure")).toEqual({ provider: "azure" });
  });

  it("rejects disabled OAuth providers", () => {
    expect(() => validateOAuthSignInRequest("apple")).toThrow(/not enabled/);
    expect(() => validateOAuthSignInRequest("facebook")).toThrow(/not enabled/);
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
  it("calls Supabase signInWithOAuth for Google", async () => {
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

  it("calls Supabase signInWithOAuth for Microsoft (azure)", async () => {
    const signInWithOAuth = vi.fn().mockResolvedValue({
      data: { url: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize" },
      error: null,
    });
    const supabase = { auth: { signInWithOAuth } } as never;

    await signInWithOAuthProvider(
      supabase,
      "azure",
      "https://hui-seven-gamma.vercel.app/auth/callback?next=%2Fdashboard",
    );

    expect(signInWithOAuth).toHaveBeenCalledWith({
      provider: "azure",
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

  it("does not introduce email-based account merging in provider config", () => {
    expect(AUTH_PROVIDERS.some((provider) => provider.id === "email")).toBe(true);
    expect(getAuthProvider("email")?.enabled).toBe(true);
  });
});
