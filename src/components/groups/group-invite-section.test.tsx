import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { GroupInviteSection } from "@/components/groups/group-invite-section";

vi.mock("@/app/groups/invite-actions", () => ({
  regenerateGroupInviteLinkAction: vi.fn(),
}));

describe("GroupInviteSection", () => {
  afterEach(() => {
    cleanup();
  });

  it("shows one invite area with Share invite and Copy link", () => {
    render(
      <GroupInviteSection
        groupId="g-1"
        groupName="Whānau"
        inviteToken="tok"
        appOrigin="https://hui.example"
      />,
    );

    expect(screen.getByRole("heading", { name: "Invite people" })).toBeTruthy();
    expect(screen.getByText(/future hui in this group/i)).toBeTruthy();
    expect(screen.getByText(/join the group/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Share invite" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Copy link" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Copy invite link" })).toBeNull();
  });

  it("requires confirmation before resetting the link", async () => {
    const user = userEvent.setup();
    render(
      <GroupInviteSection
        groupId="g-1"
        inviteToken="tok"
        appOrigin="https://hui.example"
      />,
    );

    await user.click(screen.getByRole("button", { name: "Reset link" }));
    expect(screen.getByText(/Reset the invite link/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Yes, reset link" })).toBeTruthy();
  });
});
