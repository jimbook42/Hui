import { describe, expect, it } from "vitest";

import { GROUP_INVITE_GROUP_ACCESS_NOTE, GROUP_INVITE_HUI_ACCESS_NOTE } from "./copy";

describe("group invite copy", () => {
  it("explains hui-scoped invites in plain language", () => {
    expect(GROUP_INVITE_HUI_ACCESS_NOTE).toMatch(/this hui/i);
    expect(GROUP_INVITE_HUI_ACCESS_NOTE.length).toBeLessThan(120);
  });

  it("keeps a shorter group-only note", () => {
    expect(GROUP_INVITE_GROUP_ACCESS_NOTE).toMatch(/group/i);
    expect(GROUP_INVITE_GROUP_ACCESS_NOTE.length).toBeLessThan(120);
  });
});
