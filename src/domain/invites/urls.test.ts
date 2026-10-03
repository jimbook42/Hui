import { describe, expect, it } from "vitest";

import { buildGroupInviteUrl, inviteUrlContainsNoGroupId } from "./urls";

describe("invite URLs", () => {
  it("builds join paths without embedding group ids", () => {
    const groupId = "550e8400-e29b-41d4-a716-446655440000";
    const token = "abc123def456ghi789jkl012mno345pqr678stu901vwx234yz";
    const url = buildGroupInviteUrl("https://hui.example/", token);
    expect(url).toBe(`https://hui.example/join/${token}`);
    expect(inviteUrlContainsNoGroupId(url, groupId)).toBe(true);
  });
});
