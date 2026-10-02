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
  it("keeps email/password enabled alongside Google, Microsoft, and Facebook OAuth", () => {
    expect(isEmailAuthEnabled()).toBe(true);
    expect(getEnabledOAuthProviders().map((provider) => provider.id)).toEqual([
      "google",
      "azure",
      "facebook",
    ]);
  });

  it("enables Google, Microsoft, and Facebook among OAuth providers", () => {
    for (const id of AUTH_OAUTH_PROVIDER_IDS) {
      expect(getAuthProvider(id)?.enabled).toBe(
        id === "google" || id === "azure" || id === "facebook",
      );
    }
  });

  it("keeps Apple hidden (disabled)", () => {
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

  it("keeps provider enablement independently controllable", () => {
    expect(getAuthProvider("google")?.enabled).toBe(true);
    expect(getAuthProvider("azure")?.enabled).toBe(true);
    expect(getAuthProvider("facebook")?.enabled).toBe(true);
    expect(getAuthProvider("apple")?.enabled).toBe(false);
  });
});

describe("validateOAuthSignInRequest", () => {
  it("allows Google, Microsoft, and Facebook when enabled", () => {
    expect(validateOAuthSignInRequest("google")).toEqual({ provider: "google" });
    expect(validateOAuthSignInRequest("azure")).toEqual({ provider: "azure" });
    expect(validateOAuthSignInRequest("facebook")).toEqual({
      provider: "facebook",
    });
  });

  it("rejects disabled OAuth providers", () => {
    expect(() => validateOAuthSignInRequest("apple")).toThrow(/not enabled/);
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

  it("uses the same cancellation mapping for Facebook access_denied", () => {
    expect(oauthCallbackFailureReason("access_denied")).toBe("cancelled");
  });

  it("uses the same failure mapping for Facebook provider errors", () => {
    expect(oauthCallbackFailureReason("server_error")).toBe("failed");
  });
});

describe("signInWithOAuthProvider", () => {
  const callbackUrl =
    "https://hui-seven-gamma.vercel.app/auth/callback?next=%2Fdashboard";

  it("calls Supabase signInWithOAuth for Google", async () => {
    const signInWithOAuth = vi.fn().mockResolvedValue({
      data: { url: "https://accounts.google.com/o/oauth2/v2/auth" },
      error: null,
    });
    const supabase = { auth: { signInWithOAuth } } as never;

    await signInWithOAuthProvider(supabase, "google", callbackUrl);

    expect(signInWithOAuth).toHaveBeenCalledWith({
      provider: "google",
      options: {
        redirectTo: callbackUrl,
      },
    });
  });

  it("calls Supabase signInWithOAuth for Microsoft (azure)", async () => {
    const signInWithOAuth = vi.fn().mockResolvedValue({
      data: { url: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize" },
      error: null,
    });
    const supabase = { auth: { signInWithOAuth } } as never;

    await signInWithOAuthProvider(supabase, "azure", callbackUrl);

    expect(signInWithOAuth).toHaveBeenCalledWith({
      provider: "azure",
      options: {
        redirectTo: callbackUrl,
        scopes: "email",
      },
    });
  });

  it("calls Supabase signInWithOAuth for Facebook", async () => {
    const signInWithOAuth = vi.fn().mockResolvedValue({
      data: { url: "https://www.facebook.com/v18.0/dialog/oauth" },
      error: null,
    });
    const supabase = { auth: { signInWithOAuth } } as never;

    await signInWithOAuthProvider(supabase, "facebook", callbackUrl);

    expect(signInWithOAuth).toHaveBeenCalledWith({
      provider: "facebook",
      options: {
        redirectTo: callbackUrl,
      },
    });
  });

  it("does not add scopes to Google OAuth", async () => {
    const signInWithOAuth = vi.fn().mockResolvedValue({
      data: { url: "https://accounts.google.com/o/oauth2/v2/auth" },
      error: null,
    });
    const supabase = { auth: { signInWithOAuth } } as never;

    await signInWithOAuthProvider(supabase, "google", callbackUrl);

    const options = signInWithOAuth.mock.calls[0]?.[0]?.options;
    expect(options).not.toHaveProperty("scopes");
  });

  it("does not add scopes to Facebook OAuth", async () => {
    const signInWithOAuth = vi.fn().mockResolvedValue({
      data: { url: "https://www.facebook.com/v18.0/dialog/oauth" },
      error: null,
    });
    const supabase = { auth: { signInWithOAuth } } as never;

    await signInWithOAuthProvider(supabase, "facebook", callbackUrl);

    const options = signInWithOAuth.mock.calls[0]?.[0]?.options;
    expect(options).not.toHaveProperty("scopes");
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
