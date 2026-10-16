import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getServerAuthUser, getServerSupabase, householdsEnabled } = vi.hoisted(() => ({
  getServerAuthUser: vi.fn(),
  getServerSupabase: vi.fn(),
  householdsEnabled: vi.fn(),
}));

vi.mock("@/lib/auth/server-session", () => ({
  getServerAuthUser,
  getServerSupabase,
}));

vi.mock("@/lib/features", () => ({
  householdsEnabled,
  profileHuiGroupsDescription: () => "Households copy",
}));

vi.mock("@/components/app/app-shell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/app/auth/actions", () => ({
  signOutAction: vi.fn(),
}));

import ProfilePage from "@/app/(protected)/profile/page";

describe("ProfilePage hub", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getServerAuthUser.mockResolvedValue({ id: "user-1", email: "sam@hui.test" });
    getServerSupabase.mockResolvedValue({
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: () =>
              Promise.resolve({ data: { display_name: "Sam" }, error: null }),
          }),
        }),
      }),
    });
  });

  it("hides the Hui groups row when households are off", async () => {
    householdsEnabled.mockReturnValue(false);
    render(await ProfilePage());
    expect(screen.queryByRole("link", { name: "Hui groups" })).toBeNull();
  });

  it("shows the Hui groups row when households are on", async () => {
    householdsEnabled.mockReturnValue(true);
    render(await ProfilePage());
    expect(screen.getByRole("link", { name: /Hui groups/ })).toHaveAttribute(
      "href",
      "/profile/groups",
    );
  });
});
