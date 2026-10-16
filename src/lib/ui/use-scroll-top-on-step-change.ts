"use client";

import { type RefObject, useLayoutEffect, useRef } from "react";

import { scrollAndFocusStepTop } from "@/lib/ui/scroll-to-step-top";

type UseScrollTopOnStepChangeOptions = {
  /** When false, track step without scrolling (e.g. until client restore / hash hydration). */
  enabled?: boolean;
  rootRef?: RefObject<HTMLElement | null>;
};

/**
 * Scroll to the top when a wizard step changes. Skips the first enabled render and
 * does nothing while disabled (so restore / deep-link hydration does not scroll).
 */
export function useScrollTopOnStepChange(
  step: unknown,
  options?: UseScrollTopOnStepChangeOptions,
): void {
  const enabled = options?.enabled ?? true;
  const rootRef = options?.rootRef;
  const previousStepRef = useRef(step);
  const baselineEstablishedRef = useRef(false);

  useLayoutEffect(() => {
    if (!enabled) {
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
    scrollAndFocusStepTop(rootRef?.current ?? null);
  }, [step, enabled, rootRef]);
}
