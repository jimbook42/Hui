import { describe, expect, it } from "vitest";

import {
  authPathWithNext,
  isProtectedPath,
  sanitizeNextPath,
} from "./routes";
import { buildOAuthCallbackUrl } from "./oauth";

describe("auth routes", () => {
  it("keeps join invite paths public", () => {
    expect(isProtectedPath("/join/abc-token")).toBe(false);
  });

  it("preserves join paths through auth redirects", () => {
    const next = "/join/some-invite-token-value";
    expect(sanitizeNextPath(next)).toBe(next);
  });

  it("rejects protocol-relative and external open redirects", () => {
    expect(sanitizeNextPath("//evil.example/phish")).toBe("/dashboard");
    expect(sanitizeNextPath("https://evil.example")).toBe("/dashboard");
    expect(sanitizeNextPath("")).toBe("/dashboard");
  });

  it("rejects backslashes and scheme-like paths", () => {
    expect(sanitizeNextPath("/\\evil.example")).toBe("/dashboard");
    expect(sanitizeNextPath("/join/token\\@evil")).toBe("/dashboard");
    expect(sanitizeNextPath("/javascript:alert(1)")).toBe("/dashboard");
  });

  it("decodes a once-encoded safe join path", () => {
    const join = "/join/invite-token-abc";
    expect(sanitizeNextPath(encodeURIComponent(join))).toBe(join);
  });

  it("rejects encoded protocol-relative paths", () => {
    expect(sanitizeNextPath("%2F%2Fevil.example")).toBe("/dashboard");
    expect(sanitizeNextPath("/%2F%2Fevil.example")).toBe("/dashboard");
  });

  it("rejects redirecting back into auth entry routes", () => {
    expect(sanitizeNextPath("/sign-in")).toBe("/dashboard");
    expect(sanitizeNextPath("/sign-up?next=/dashboard")).toBe("/dashboard");
  });
});

describe("authPathWithNext", () => {
  const invite = "/join/group-invite-token";

  it("omits next when the destination is the default dashboard", () => {
    expect(authPathWithNext("/sign-up", "/dashboard")).toBe("/sign-up");
    expect(authPathWithNext("/sign-up", undefined)).toBe("/sign-up");
  });

  it("appends next for invite continuation links", () => {
    expect(authPathWithNext("/sign-up", invite)).toBe(
      `/sign-up?next=${encodeURIComponent(invite)}`,
    );
    expect(authPathWithNext("/sign-in", invite)).toBe(
      `/sign-in?next=${encodeURIComponent(invite)}`,
    );
    expect(authPathWithNext("/sign-in/email", invite)).toBe(
      `/sign-in/email?next=${encodeURIComponent(invite)}`,
    );
  });
});

describe("OAuth callback URL with invite next", () => {
  it("includes the invite path in redirectTo for each provider entrypoint", () => {
    const origin = "https://huiapp.vercel.app";
    const invite = "/join/some-invite-token-value";
    expect(buildOAuthCallbackUrl(origin, invite)).toBe(
      `https://huiapp.vercel.app/auth/callback?next=${encodeURIComponent(invite)}`,
    );
  });
});
