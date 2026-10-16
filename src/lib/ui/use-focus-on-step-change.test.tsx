import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useFocusOnStepChange } from "./use-focus-on-step-change";

describe("useFocusOnStepChange", () => {
  const scrollTo = vi.fn();
  const focus = vi.fn();

  beforeEach(() => {
    scrollTo.mockReset();
    focus.mockReset();
    vi.stubGlobal("scrollTo", scrollTo);
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      cb(0);
      return 0;
    });
    HTMLElement.prototype.focus = focus;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("does not scroll the window when the step changes", () => {
    const root = document.createElement("div");
    root.innerHTML =
      '<h3 data-step-heading tabindex="-1">Warning</h3>';
    const rootRef = { current: root };

    const { rerender } = renderHook(
      ({ step }) => useFocusOnStepChange(step, rootRef),
      { initialProps: { step: "idle" as string } },
    );

    act(() => {
      rerender({ step: "warning" });
    });

    expect(scrollTo).not.toHaveBeenCalled();
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
  });

  it("does not focus on initial mount", () => {
    const root = document.createElement("div");
    root.innerHTML = '<h3 data-step-heading>Warning</h3>';
    const rootRef = { current: root };

    renderHook(() => useFocusOnStepChange("idle", rootRef));

    expect(focus).not.toHaveBeenCalled();
  });
});
