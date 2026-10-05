import { describe, expect, it } from "vitest";

import { parseInviteJoinPayload, parseInviteResolvePayload } from "./resolve";

describe("invite resolve payloads", () => {
  it("parses valid and invalid resolve responses", () => {
    expect(parseInviteResolvePayload({ status: "invalid" })).toEqual({
      status: "invalid",
    });
    expect(
      parseInviteResolvePayload({
        status: "valid",
        groupId: "g1",
        groupName: "Friends",
      }),
    ).toEqual({
      status: "valid",
      groupId: "g1",
      groupName: "Friends",
      inviterDisplayName: null,
      planning: null,
    });
  });

  it("parses join outcomes", () => {
    expect(parseInviteJoinPayload({ status: "joined", groupId: "g1" })).toEqual({
      status: "joined",
      groupId: "g1",
    });
    expect(
      parseInviteJoinPayload({ status: "already_member", groupId: "g1" }),
    ).toEqual({
      status: "already_member",
      groupId: "g1",
    });
  });
});
