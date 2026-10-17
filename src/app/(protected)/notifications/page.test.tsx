import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: async () => ({ data: { user: { id: "u1" } } }) },
  })),
}));

vi.mock("@/lib/notifications/queries", () => ({
  listMemberNotifications: vi.fn(async () => []),
  syncReconnectReminders: vi.fn(async () => undefined),
}));

vi.mock("@/lib/push/schedule", () => ({
  schedulePushDelivery: vi.fn(),
}));

vi.mock("@/components/app/app-shell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/notifications/notifications-list-paginated", () => ({
  NotificationsListPaginated: () => <div data-testid="notifications-list" />,
}));

import NotificationsPage from "./page";

describe("NotificationsPage", () => {
  it("links to notification settings with the settings anchor", async () => {
    const page = await NotificationsPage();
    render(page);
    const link = screen.getByRole("link", { name: /Too many notifications/i });
    expect(link).toHaveAttribute("href", "/profile/notifications#notification-settings");
  });
});
