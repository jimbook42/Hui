import { beforeEach, describe, expect, it, vi } from "vitest";

const { householdsEnabled, redirect } = vi.hoisted(() => ({
  householdsEnabled: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));

vi.mock("@/lib/features", () => ({
  householdsEnabled,
}));

vi.mock("next/navigation", () => ({
  redirect,
}));

vi.mock("@/lib/auth/server-session", () => ({
  getServerAuthUser: vi.fn(),
  getServerSupabase: vi.fn(),
}));

import ProfileGroupsPage from "@/app/(protected)/profile/groups/page";

describe("ProfileGroupsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects to /groups when households are off", async () => {
    householdsEnabled.mockReturnValue(false);
    await expect(ProfileGroupsPage()).rejects.toThrow("REDIRECT:/groups");
  });
});
