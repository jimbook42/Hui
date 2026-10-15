import "@testing-library/jest-dom/vitest";
import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fetchEventLifecycleStatusAction } from "@/app/events/actions";
import {
  EVENT_LIFECYCLE_POLL_MS,
  EventLifecycleLiveRefresh,
} from "@/components/events/event-lifecycle-live-refresh";

vi.mock("@/app/events/actions", () => ({
  fetchEventLifecycleStatusAction: vi.fn(),
}));

const mockRefresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}));

const mockCreateClient = vi.fn(() => ({
  channel: () => ({
    on: () => ({
      subscribe: () => ({}),
    }),
  }),
  removeChannel: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => mockCreateClient(),
}));

const mockHasPublicSupabaseConfig = vi.fn(() => true);
vi.mock("@/lib/supabase/env", () => ({
  hasPublicSupabaseConfig: () => mockHasPublicSupabaseConfig(),
}));

describe("EventLifecycleLiveRefresh", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockRefresh.mockReset();
    mockCreateClient.mockClear();
    mockHasPublicSupabaseConfig.mockReturnValue(true);
    vi.mocked(fetchEventLifecycleStatusAction).mockReset();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("polls lifecycle status on an interval and refreshes when the hui confirms", async () => {
    vi.mocked(fetchEventLifecycleStatusAction).mockResolvedValue({ status: "confirmed" });

    render(<EventLifecycleLiveRefresh eventId="event-1" status="proposing" />);

    await vi.advanceTimersByTimeAsync(EVENT_LIFECYCLE_POLL_MS);

    expect(fetchEventLifecycleStatusAction).toHaveBeenCalledWith("event-1");
    expect(mockRefresh).toHaveBeenCalledTimes(1);
  });

  it("does not refresh when status is still proposing", async () => {
    vi.mocked(fetchEventLifecycleStatusAction).mockResolvedValue({ status: "proposing" });

    render(<EventLifecycleLiveRefresh eventId="event-1" status="proposing" />);

    await vi.advanceTimersByTimeAsync(EVENT_LIFECYCLE_POLL_MS);

    expect(mockRefresh).not.toHaveBeenCalled();
  });

  it("polls without opening a browser Supabase client when public config is absent", async () => {
    mockHasPublicSupabaseConfig.mockReturnValue(false);
    vi.mocked(fetchEventLifecycleStatusAction).mockResolvedValue({ status: "confirmed" });

    render(<EventLifecycleLiveRefresh eventId="event-1" status="proposing" />);

    await vi.advanceTimersByTimeAsync(EVENT_LIFECYCLE_POLL_MS);

    expect(mockCreateClient).not.toHaveBeenCalled();
    expect(fetchEventLifecycleStatusAction).toHaveBeenCalledWith("event-1");
    expect(mockRefresh).toHaveBeenCalledTimes(1);
  });
});
