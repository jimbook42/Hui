import { beforeEach, describe, expect, it, vi } from "vitest";

const { createClient, getEventDetail, redirect, revalidatePath } = vi.hoisted(() => ({
  createClient: vi.fn(),
  getEventDetail: vi.fn(),
  redirect: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient,
}));

vi.mock("@/lib/events/queries", () => ({
  getEventDetail,
  getEventStatus: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath,
}));

vi.mock("next/navigation", () => ({
  redirect,
}));

import { deleteEventAction } from "@/app/events/actions";

describe("deleteEventAction", () => {
  const user = { id: "00000000-0000-4000-8000-000000000010", email: "u@hui.test" };
  const eventId = "00000000-0000-4000-8000-000000000001";
  const groupId = "00000000-0000-4000-8000-000000000002";

  beforeEach(() => {
    vi.clearAllMocks();
    createClient.mockResolvedValue({
      auth: {
        getUser: async () => ({ data: { user } }),
      },
      rpc: vi.fn().mockResolvedValue({
        error: {
          message:
            'update or delete on table "event_decision_options" violates foreign key constraint "event_decisions_selected_option_fkey"',
          code: "23503",
        },
      }),
    });
    getEventDetail.mockResolvedValue({
      groupId,
      createdBy: user.id,
      viewerRole: "owner",
    });
  });

  it("maps delete_event RPC failures to a friendly message", async () => {
    const formData = new FormData();
    formData.set("event_id", eventId);

    const result = await deleteEventAction({}, formData);

    expect(result).toEqual({ error: "Couldn't delete this hui. Please try again." });
    expect(redirect).not.toHaveBeenCalled();
  });
});
