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
  });
});
