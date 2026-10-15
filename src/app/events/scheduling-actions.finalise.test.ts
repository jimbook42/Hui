import { beforeEach, describe, expect, it, vi } from "vitest";

const { rpc, getEventDetail } = vi.hoisted(() => ({
  rpc: vi.fn(),
  getEventDetail: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }),
    },
    rpc,
  }),
}));

vi.mock("@/lib/events/queries", () => ({
  getEventDetail,
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/push/schedule", () => ({
  schedulePushDelivery: vi.fn(),
}));

import { finaliseEventAction } from "@/app/events/scheduling-actions";

describe("finaliseEventAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rpc.mockResolvedValue({ error: null });
    getEventDetail.mockResolvedValue({
      status: "proposing",
      viewerRole: "owner",
      createdBy: "user-1",
      groupId: "group-1",
    });
  });

  it("finalises organiser-picks hui without force confirm", async () => {
    const formData = new FormData();
    formData.set("event_id", "event-1");
    formData.set("candidate_id", "candidate-1");

    const result = await finaliseEventAction({}, formData);

    expect(result).toEqual({ message: "Event confirmed." });
    expect(rpc).toHaveBeenCalledWith("finalise_event", {
      p_event_id: "event-1",
      p_candidate_id: "candidate-1",
      p_force: false,
    });
  });

  it("surfaces RPC errors from finalise_event", async () => {
    rpc.mockResolvedValue({
      error: { message: "waiting on the host to say yes to this time" },
    });
    const formData = new FormData();
    formData.set("event_id", "event-1");
    formData.set("candidate_id", "candidate-1");

    const result = await finaliseEventAction({}, formData);

    expect(result).toEqual({
      error: "waiting on the host to say yes to this time",
    });
  });
});
