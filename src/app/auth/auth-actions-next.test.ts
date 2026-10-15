import { describe, expect, it, vi, beforeEach } from "vitest";

import { buildOAuthCallbackUrl } from "@/lib/auth/oauth";
import { sanitizeNextPath } from "@/lib/auth/routes";

describe("email auth actions post-login redirect", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("sanitizes next from sign-in and sign-up form payloads", () => {
    const invite = "/join/abc123";
    expect(sanitizeNextPath(invite)).toBe(invite);
    expect(sanitizeNextPath("//evil")).toBe("/dashboard");
  });
});

describe("oauthSignInAction redirectTo", () => {
  it("builds callback URLs that round-trip invite paths", () => {
    const invite = "/join/token-with-event?event=evt-1";
    const callback = buildOAuthCallbackUrl("https://huiapp.vercel.app", invite);
    const url = new URL(callback);
    expect(sanitizeNextPath(url.searchParams.get("next"))).toBe(invite);
  });
});
