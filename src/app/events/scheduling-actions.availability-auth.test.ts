import { beforeEach, describe, expect, it, vi } from "vitest";

const { getServerAuthUserFromSession, getServerSupabase, redirect } = vi.hoisted(() => ({
  getServerAuthUserFromSession: vi.fn(),
  getServerSupabase: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));

vi.mock("@/lib/auth/server-session", () => ({
  getServerAuthUserFromSession,
  getServerSupabase,
}));

vi.mock("next/navigation", () => ({
  redirect,
}));

vi.mock("@/lib/scheduling/availability-save-context", () => ({
  loadAvailabilitySaveContext: vi.fn(),
}));

vi.mock("@/lib/scheduling/upsert-member-availability", () => ({
  upsertMemberAvailability: vi.fn(),
}));

vi.mock("next/server", () => ({
  after: vi.fn(),
}));

vi.mock("@/lib/push/schedule", () => ({
  schedulePushDelivery: vi.fn(),
}));

import { setAvailabilityResponseAction } from "@/app/events/scheduling-actions";

describe("setAvailabilityResponseAction auth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getServerSupabase.mockResolvedValue({});
  });

  it("rejects unauthenticated callers (invalid or missing JWT)", async () => {
    getServerAuthUserFromSession.mockResolvedValue(null);

    const formData = new FormData();
    formData.set("event_id", "event-1");
    formData.set("candidate_id", "candidate-1");
    formData.set("response", "available");

    await expect(setAvailabilityResponseAction({}, formData)).rejects.toThrow(
      "REDIRECT:/sign-in",
    );
  });
});
