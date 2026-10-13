"use client";

import { useEffect } from "react";

import {
  beginInteraction,
  initInteractionPerf,
  markInteraction,
} from "@/lib/perf/client-interaction-perf";

/** Enables `?hui_perf=1` / localStorage `hui_perf=1` interaction timing in the browser console. */
export function InteractionPerfBootstrap() {
  useEffect(() => {
    initInteractionPerf();
    beginInteraction("navigation");
    markInteraction("navigation", "route-shell-visible");
    const id = requestAnimationFrame(() => {
      markInteraction("navigation", "first-useful-ui");
    });
    return () => cancelAnimationFrame(id);
  }, []);
  return null;
}
