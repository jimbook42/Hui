import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CANONICAL_USER_ID_FIELD } from "./identity";
import {
  buildOAuthCallbackUrl,
  oauthCallbackFailureReason,
  signInWithOAuthProvider,
  validateOAuthSignInRequest,
} from "./oauth";
import {
  AUTH_OAUTH_PROVIDER_IDS,
  getAuthProvider,
  getAuthProviders,
  getEnabledOAuthProviders,
  isEmailAuthEnabled,
  isFacebookLoginEnabled,
} from "./providers";

describe("auth providers", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    delete process.env.NEXT_PUBLIC_ENABLE_FACEBOOK_LOGIN;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("keeps email/password enabled alongside Google and Microsoft OAuth by default", () => {
    expect(isEmailAuthEnabled()).toBe(true);
    expect(getEnabledOAuthProviders().map((provider) => provider.id)).toEqual([
      "google",
      "azure",
    ]);
  });

  it("enables Google and Microsoft among OAuth providers by default", () => {
    for (const id of AUTH_OAUTH_PROVIDER_IDS) {
      expect(getAuthProvider(id)?.enabled).toBe(
        id === "google" || id === "azure",
      );
    }
  });

  it("keeps Apple hidden (disabled)", () => {
    expect(getAuthProvider("apple")?.enabled).toBe(false);
  });

  it("defines planned OAuth providers with continue labels", () => {
    expect(getAuthProvider("google")?.continueLabel).toBe("Sign in with Google");
    expect(getAuthProvider("azure")?.continueLabel).toBe(
      "Sign in with Microsoft",
    );
    expect(getAuthProvider("apple")?.continueLabel).toBe("Continue with Apple");
    expect(getAuthProvider("facebook")?.continueLabel).toBe(
      "Sign in with Facebook",
    );
  });

  it("maps OAuth providers to Supabase provider ids", () => {
    for (const id of AUTH_OAUTH_PROVIDER_IDS) {
      expect(getAuthProvider(id)?.supabaseOAuthProvider).toBe(id);
    }
  });

  it("lists email and each OAuth provider exactly once", () => {
    const ids = getAuthProviders().map((provider) => provider.id);
    expect(ids).toEqual([...AUTH_OAUTH_PROVIDER_IDS, "email"]);
  });

  it("keeps provider enablement independently controllable", () => {
    expect(getAuthProvider("google")?.enabled).toBe(true);
    expect(getAuthProvider("azure")?.enabled).toBe(true);
    expect(getAuthProvider("facebook")?.enabled).toBe(false);
    expect(getAuthProvider("apple")?.enabled).toBe(false);
  });
});

describe("isFacebookLoginEnabled", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("is off when unset", () => {
    vi.unstubAllEnvs();
    delete process.env.NEXT_PUBLIC_ENABLE_FACEBOOK_LOGIN;
    expect(isFacebookLoginEnabled()).toBe(false);
    expect(getAuthProvider("facebook")?.enabled).toBe(false);
  });

  it("is off for false and other strings (including TRUE)", () => {
    vi.stubEnv("NEXT_PUBLIC_ENABLE_FACEBOOK_LOGIN", "false");
    expect(isFacebookLoginEnabled()).toBe(false);
    vi.stubEnv("NEXT_PUBLIC_ENABLE_FACEBOOK_LOGIN", "TRUE");
    expect(isFacebookLoginEnabled()).toBe(false);
    vi.stubEnv("NEXT_PUBLIC_ENABLE_FACEBOOK_LOGIN", "1");
    expect(isFacebookLoginEnabled()).toBe(false);
  });

  it("is on only for the exact string true", () => {
    vi.stubEnv("NEXT_PUBLIC_ENABLE_FACEBOOK_LOGIN", "true");
    expect(isFacebookLoginEnabled()).toBe(true);
    expect(getEnabledOAuthProviders().map((p) => p.id)).toEqual([
      "google",
      "azure",
      "facebook",
    ]);
    expect(validateOAuthSignInRequest("facebook")).toEqual({
      provider: "facebook",
    });
  });
});

describe("validateOAuthSignInRequest", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    delete process.env.NEXT_PUBLIC_ENABLE_FACEBOOK_LOGIN;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("allows Google and Microsoft when enabled", () => {
    expect(validateOAuthSignInRequest("google")).toEqual({ provider: "google" });
    expect(validateOAuthSignInRequest("azure")).toEqual({ provider: "azure" });
  });

  it("rejects Facebook when the feature flag is off", () => {
    expect(() => validateOAuthSignInRequest("facebook")).toThrow(/not enabled/);
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

  it("preserves group invite paths for OAuth return", () => {
    const invite = "/join/secret-invite-token";
    expect(
      buildOAuthCallbackUrl("https://huiapp.vercel.app", invite),
    ).toBe(
      `https://huiapp.vercel.app/auth/callback?next=${encodeURIComponent(invite)}`,
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
  beforeEach(() => {
    vi.unstubAllEnvs();
    delete process.env.NEXT_PUBLIC_ENABLE_FACEBOOK_LOGIN;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

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

  it("calls Supabase signInWithOAuth for Facebook when enabled", async () => {
    vi.stubEnv("NEXT_PUBLIC_ENABLE_FACEBOOK_LOGIN", "true");
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

  it("does not add scopes to Facebook OAuth when enabled", async () => {
    vi.stubEnv("NEXT_PUBLIC_ENABLE_FACEBOOK_LOGIN", "true");
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

  it("does not call Supabase for Facebook when the feature flag is off", async () => {
    const signInWithOAuth = vi.fn();
    const supabase = { auth: { signInWithOAuth } } as never;

    await expect(
      signInWithOAuthProvider(supabase, "facebook", callbackUrl),
    ).rejects.toThrow(/not enabled/);
    expect(signInWithOAuth).not.toHaveBeenCalled();
  });
});

describe("canonical identity", () => {
  it("documents Supabase auth user id as the Hui identity source", () => {
    expect(CANONICAL_USER_ID_FIELD).toBe("auth.users.id");
  });

  it("does not introduce email-based account merging in provider config", () => {
    expect(getAuthProviders().some((provider) => provider.id === "email")).toBe(
      true,
    );
    expect(getAuthProvider("email")?.enabled).toBe(true);
  });
});
