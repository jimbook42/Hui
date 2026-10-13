import { describe, expect, it } from "vitest";

import { appVersion, appVersionLine } from "@/lib/build/app-version";
import { buildStamp } from "@/lib/build/stamp";

describe("appVersion", () => {
  it("reads semver from package.json", () => {
    expect(appVersion()).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("formats the footer line with build stamp", () => {
    expect(appVersionLine()).toBe(`Hui v${appVersion()} · ${buildStamp()}`);
  });
});
