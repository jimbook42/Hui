import { describe, expect, it } from "vitest";

import { resolveSessionGuard } from "./middleware-guard";

describe("resolveSessionGuard", () => {
  it("redirects unauthenticated users away from protected routes", () => {
    expect(
      resolveSessionGuard({ pathname: "/dashboard", hasUser: false }),
    ).toEqual({
      action: "redirect",
      location: "/sign-in?next=%2Fdashboard",
    });
    expect(
      resolveSessionGuard({ pathname: "/groups", hasUser: false }),
    ).toEqual({
      action: "redirect",
      location: "/sign-in?next=%2Fgroups",
    });
    expect(
      resolveSessionGuard({ pathname: "/events/abc", hasUser: false }),
    ).toEqual({
      action: "redirect",
      location: "/sign-in?next=%2Fevents%2Fabc",
    });
  });

  it("allows public join invite routes without a session", () => {
    expect(
      resolveSessionGuard({ pathname: "/join/secret-token", hasUser: false }),
    ).toEqual({ action: "next" });
  });

  it("allows public routes without a session", () => {
    expect(resolveSessionGuard({ pathname: "/", hasUser: false })).toEqual({
      action: "next",
    });
  });

  it("redirects signed-in users away from auth entry routes", () => {
    expect(resolveSessionGuard({ pathname: "/sign-in", hasUser: true })).toEqual({
      action: "redirect",
      location: "/dashboard",
    });
  });

  it("allows sign-in with deleted=1 so post-deletion sign-out can finish", () => {
    expect(
      resolveSessionGuard({
        pathname: "/sign-in",
        hasUser: true,
        accountDeletedParam: "1",
      }),
    ).toEqual({ action: "next" });
  });

  it("honours a safe next path when leaving auth routes", () => {
    expect(
      resolveSessionGuard({
        pathname: "/sign-in",
        hasUser: true,
        nextParam: "/profile",
      }),
    ).toEqual({
      action: "redirect",
      location: "/profile",
    });
    expect(
      resolveSessionGuard({
        pathname: "/sign-in",
        hasUser: true,
        nextParam: "/join/invite-token",
      }),
    ).toEqual({
      action: "redirect",
      location: "/join/invite-token",
    });
  });
});
