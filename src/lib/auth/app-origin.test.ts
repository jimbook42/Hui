import { describe, expect, it } from "vitest";

import {
  getConfiguredAppOrigin,
  resolveAuthRedirectOriginFromRequest,
} from "./app-origin";

describe("app origin", () => {
  it("reads optional NEXT_PUBLIC_APP_URL without a trailing slash", () => {
    expect(
      getConfiguredAppOrigin({
        NEXT_PUBLIC_APP_URL: "https://hui-seven-gamma.vercel.app/",
      }),
    ).toBe("https://hui-seven-gamma.vercel.app");
  });

  it("derives origin from forwarded request headers", () => {
    const request = new Request("http://localhost:3000/sign-in", {
      headers: {
        "x-forwarded-host": "hui-seven-gamma.vercel.app",
        "x-forwarded-proto": "https",
      },
    });

    expect(
      resolveAuthRedirectOriginFromRequest(request as never),
    ).toBe("https://hui-seven-gamma.vercel.app");
  });
});
