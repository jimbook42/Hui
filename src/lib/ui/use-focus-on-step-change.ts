"use client";

import { type RefObject, useLayoutEffect, useRef } from "react";

import { focusInlineStepTarget } from "@/lib/ui/scroll-to-step-top";

/**
 * Focus the current inline step (no window scroll). For sections embedded mid-page.
 */
export function useFocusOnStepChange(
  step: unknown,
  rootRef: RefObject<HTMLElement | null>,
): void {
  const previousStepRef = useRef(step);
  const baselineEstablishedRef = useRef(false);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) {
      previousStepRef.current = step;
      return;
    }

    if (!baselineEstablishedRef.current) {
      baselineEstablishedRef.current = true;
      previousStepRef.current = step;
      return;
    }

    if (Object.is(previousStepRef.current, step)) {
      return;
    }

    previousStepRef.current = step;
    focusInlineStepTarget(root);
  }, [step, rootRef]);
}
