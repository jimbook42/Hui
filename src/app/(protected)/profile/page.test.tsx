import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

vi.mock("@/lib/perf/dev-server-timing", () => ({
  devTimed: async <T,>(_label: string, fn: () => Promise<T> | T) => await fn(),
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/components/app/app-shell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/app/auth/actions", () => ({
  signOutAction: vi.fn(),
}));

import ProfilePage from "@/app/(protected)/profile/page";

async function flushReactWork() {
  await act(async () => {
    await new Promise<void>((resolve) => {
      queueMicrotask(() => resolve());
    });
  });
}

async function renderProfilePage() {
  const ui = await ProfilePage();
  let view: ReturnType<typeof render> | undefined;
  await act(async () => {
    view = render(ui);
  });
  await flushReactWork();
  return view!;
}

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

  afterEach(async () => {
    cleanup();
    await flushReactWork();
  });

  it("hides the Hui groups row when households are off", async () => {
    householdsEnabled.mockReturnValue(false);
    const view = await renderProfilePage();
    expect(screen.queryByRole("link", { name: "Hui groups" })).toBeNull();
    view.unmount();
    await flushReactWork();
  });

  it("shows the Hui groups row when households are on", async () => {
    householdsEnabled.mockReturnValue(true);
    const view = await renderProfilePage();
    expect(screen.getByRole("link", { name: /Hui groups/ })).toHaveAttribute(
      "href",
      "/profile/groups",
    );
    view.unmount();
    await flushReactWork();
  });
});
