import { describe, expect, it } from "vitest";

import { isProtectedPath, sanitizeNextPath } from "./routes";

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
});
