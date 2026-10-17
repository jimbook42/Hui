import { describe, expect, it } from "vitest";

import {
  newProposedTimeDedupeKey,
  newProposedTimeNotifyBucket,
  NEW_PROPOSED_TIME_DEDUPE_WINDOW_SEC,
} from "./new-proposed-time-notify";

describe("newProposedTimeNotifyBucket", () => {
  it("uses 15-minute buckets aligned with Postgres", () => {
    const t0 = Date.parse("2026-10-17T12:00:00.000Z");
    const t1 = t0 + 5 * 60 * 1000;
    const t2 = t0 + NEW_PROPOSED_TIME_DEDUPE_WINDOW_SEC * 1000;
    expect(newProposedTimeNotifyBucket(t0)).toBe(newProposedTimeNotifyBucket(t1));
    expect(newProposedTimeNotifyBucket(t0)).not.toBe(newProposedTimeNotifyBucket(t2));
  });

  it("builds dedupe keys per event and member", () => {
    const bucket = newProposedTimeNotifyBucket(Date.parse("2026-10-17T12:07:00.000Z"));
    expect(newProposedTimeDedupeKey("evt", "member-a", bucket)).toBe(
      `new_proposed_time:evt:member-a:${bucket}`,
    );
  });
});
