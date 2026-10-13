import { describe, expect, it } from "vitest";

import {
  hostSwapPrimaryActionLabel,
  shouldIncludeNoReplacementAck,
} from "./host-swap-form";

describe("host swap form (no replacement)", () => {
  it("requires a second step before posting acknowledge_no_replacement", () => {
    expect(shouldIncludeNoReplacementAck(false, "idle")).toBe(false);
    expect(shouldIncludeNoReplacementAck(false, "confirm")).toBe(true);
    expect(shouldIncludeNoReplacementAck(true, "confirm")).toBe(false);
  });

  it("labels the confirm submit clearly", () => {
    expect(hostSwapPrimaryActionLabel(false, "idle", false)).toBe("Ask to swap");
    expect(hostSwapPrimaryActionLabel(false, "confirm", false)).toBe("Yes, step back");
    expect(hostSwapPrimaryActionLabel(true, "idle", false)).toBe("Ask to swap");
    expect(hostSwapPrimaryActionLabel(false, "confirm", true)).toBe("Please wait…");
  });
});
