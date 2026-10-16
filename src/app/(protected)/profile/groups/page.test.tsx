import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getServerAuthUser,
  getServerSupabase,
  householdsEnabled,
  listActiveMembershipGroups,
  listUserHouseholdsByGroup,
} = vi.hoisted(() => ({
  getServerAuthUser: vi.fn(),
  getServerSupabase: vi.fn(),
  householdsEnabled: vi.fn(),
  listActiveMembershipGroups: vi.fn(),
  listUserHouseholdsByGroup: vi.fn(),
}));

vi.mock("@/lib/auth/server-session", () => ({
  getServerAuthUser,
  getServerSupabase,
}));

vi.mock("@/lib/features", () => ({
  householdsEnabled,
}));

vi.mock("@/lib/groups/user-membership-groups", () => ({
  listActiveMembershipGroups,
}));

vi.mock("@/lib/households/queries", () => ({
  listUserHouseholdsByGroup,
}));

vi.mock("@/components/households/household-section", () => ({
  HouseholdSettingsSection: () => <div data-testid="household-section" />,
}));

vi.mock("@/components/app/app-shell", () => ({
  AppShell: ({ children, title }: { children: React.ReactNode; title: string }) => (
    <div>
      <h1>{title}</h1>
      {children}
    </div>
  ),
}));

import ProfileGroupsPage from "@/app/(protected)/profile/groups/page";

describe("ProfileGroupsPage", () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    getServerAuthUser.mockResolvedValue({ id: "user-1", email: "sam@hui.test" });
    getServerSupabase.mockResolvedValue({
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: () =>
              Promise.resolve({ data: { display_name: "Sam Sharer" }, error: null }),
          }),
        }),
      }),
    });
    listActiveMembershipGroups.mockResolvedValue([
      { groupId: "g-1", groupName: "Friends" },
      { groupId: "g-2", groupName: "Family" },
    ]);
    listUserHouseholdsByGroup.mockResolvedValue([]);
  });

  it("lists membership groups when households are off", async () => {
    householdsEnabled.mockReturnValue(false);
    const page = await ProfileGroupsPage();
    render(page);

    expect(screen.getByRole("heading", { name: "Hui groups" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Friends" })).toHaveAttribute("href", "/groups/g-1");
    expect(screen.getByRole("link", { name: "Family" })).toHaveAttribute("href", "/groups/g-2");
    expect(screen.getAllByText(/You appear as Sam Sharer/)).toHaveLength(2);
    expect(screen.getAllByRole("link", { name: "Dietary sharing" })[0]).toHaveAttribute(
      "href",
      "/profile/dietary",
    );
    expect(screen.queryByTestId("household-section")).toBeNull();
  });

  it("shows the household section when households are on", async () => {
    householdsEnabled.mockReturnValue(true);
    const page = await ProfileGroupsPage();
    render(page);

    expect(screen.getByTestId("household-section")).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Friends" })).toBeNull();
  });
});
