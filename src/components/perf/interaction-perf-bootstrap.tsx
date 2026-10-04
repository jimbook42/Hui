"use client";

import { useEffect } from "react";

import { initInteractionPerf } from "@/lib/perf/client-interaction-perf";

/** Enables `?hui_perf=1` / localStorage `hui_perf=1` interaction timing in the browser console. */
export function InteractionPerfBootstrap() {
  useEffect(() => {
    initInteractionPerf();
  }, []);
  return null;
}
