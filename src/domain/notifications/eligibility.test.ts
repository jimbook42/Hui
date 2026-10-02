import { describe, expect, it } from "vitest";

import {
  consensusReadyDedupeKey,
  eventProposedDedupeKey,
  shouldSkipSelfNotification,
} from "./eligibility";

describe("notification eligibility", () => {
  it("skips notifying the actor about their own action", () => {
    expect(shouldSkipSelfNotification("u1", "u1")).toBe(true);
    expect(shouldSkipSelfNotification("u1", "u2")).toBe(false);
    expect(shouldSkipSelfNotification("u1", null)).toBe(false);
  });

  it("uses deterministic dedupe keys", () => {
    expect(eventProposedDedupeKey("evt")).toBe("event_proposed:evt");
    expect(consensusReadyDedupeKey("cand")).toBe("consensus_ready:cand");
  });
});
