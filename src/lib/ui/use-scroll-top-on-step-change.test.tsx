import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useScrollTopOnStepChange } from "./use-scroll-top-on-step-change";

describe("useScrollTopOnStepChange", () => {
  const scrollTo = vi.fn();

  beforeEach(() => {
    scrollTo.mockReset();
    vi.stubGlobal("scrollTo", scrollTo);
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      cb(0);
      return 0;
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("does not scroll on initial mount", () => {
    renderHook(() => useScrollTopOnStepChange("a"));
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it("scrolls when the step changes after mount", () => {
    const { rerender } = renderHook(
      ({ step }) => useScrollTopOnStepChange(step),
      { initialProps: { step: "a" as string } },
    );

    act(() => {
      rerender({ step: "b" });
    });

    expect(scrollTo).toHaveBeenCalledWith({ top: 0, left: 0, behavior: "auto" });
  });

  it("does not scroll when disabled then enabled on the same step", () => {
    const { rerender } = renderHook(
      ({ step, enabled }) => useScrollTopOnStepChange(step, { enabled }),
      { initialProps: { step: "restored" as string, enabled: false } },
    );

    act(() => {
      rerender({ step: "restored", enabled: true });
    });

    expect(scrollTo).not.toHaveBeenCalled();
  });
});
