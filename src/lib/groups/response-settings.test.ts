import { describe, expect, it } from "vitest";

import { getGroupResponseSettings } from "./response-settings";

describe("getGroupResponseSettings", () => {
  it("maps maybe_responses_enabled", async () => {
    const supabase = {
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: { maybe_responses_enabled: true },
              error: null,
            }),
          }),
        }),
      }),
    };

    const settings = await getGroupResponseSettings(
      supabase as never,
      "group-1",
    );
    expect(settings).toEqual({ maybeResponsesEnabled: true });
  });
});
