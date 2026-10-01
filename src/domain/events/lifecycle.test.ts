import { describe, expect, it } from "vitest";

import {
  INITIAL_EVENT_STATUS,
  assertMetadataEditable,
  cancellationPatch,
  validateMetadataUpdate,
} from "./lifecycle";

describe("event lifecycle", () => {
  it("starts new events in proposing", () => {
    expect(INITIAL_EVENT_STATUS).toBe("proposing");
  });

  it("blocks metadata edits on terminal statuses", () => {
    expect(assertMetadataEditable("cancelled")).toMatch(/no longer be edited/);
    expect(assertMetadataEditable("proposing")).toBeNull();
  });

  it("rejects status changes during metadata update", () => {
    expect(validateMetadataUpdate("proposing", "voting")).toMatch(/not available/);
    expect(validateMetadataUpdate("proposing", "proposing")).toBeNull();
  });

  it("builds cancellation patch", () => {
    const patch = cancellationPatch(new Date("2026-10-02T00:00:00.000Z"));
    expect(patch.status).toBe("cancelled");
    expect(patch.cancelled_at).toBe("2026-10-02T00:00:00.000Z");
  });
});
