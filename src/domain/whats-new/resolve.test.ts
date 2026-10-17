import { describe, expect, it } from "vitest";

import { resolveWhatsNew } from "@/domain/whats-new/resolve";

describe("resolveWhatsNew", () => {
  it("marks current version seen for new users without showing a backlog", () => {
    expect(
      resolveWhatsNew({ currentVersion: "0.18.17", lastSeenVersion: null }),
    ).toEqual({ action: "mark_seen_without_show", version: "0.18.17" });
  });

  it("shows the current release note once after an upgrade", () => {
    expect(
      resolveWhatsNew({ currentVersion: "0.18.17", lastSeenVersion: "0.18.16" }),
    ).toEqual({ action: "show", version: "0.18.17" });
  });

  it("hides when already seen", () => {
    expect(
      resolveWhatsNew({ currentVersion: "0.18.17", lastSeenVersion: "0.18.17" }),
    ).toEqual({ action: "hide" });
  });

  it("hides for versions with no release note entry", () => {
    expect(
      resolveWhatsNew({ currentVersion: "0.18.99", lastSeenVersion: "0.18.17" }),
    ).toEqual({ action: "hide" });
  });
});
