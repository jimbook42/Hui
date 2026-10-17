import { describe, expect, it } from "vitest";

import { GROUP_INVITE_GROUP_ACCESS_NOTE, GROUP_INVITE_HUI_ACCESS_NOTE } from "./copy";

describe("group invite copy", () => {
  it("explains future hui access for invites", () => {
    expect(GROUP_INVITE_GROUP_ACCESS_NOTE).toMatch(/future hui/i);
    expect(GROUP_INVITE_GROUP_ACCESS_NOTE).toMatch(/leave or are removed/i);
    expect(GROUP_INVITE_HUI_ACCESS_NOTE).toBe(GROUP_INVITE_GROUP_ACCESS_NOTE);
  });
});
