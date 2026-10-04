"use client";

type PerfPhase =
  | "tap"
  | "handler-start"
  | "optimistic-ui-visible"
  | "request-start"
  | "request-end"
  | "navigation-start"
  | "navigation-end"
  | "route-shell-visible"
  | "first-useful-ui"
  | "secondary-content-visible"
  | "fully-settled"
  | "usable-ui"
  | "total-tap-to-visible";

type InteractionSession = {
  interaction: string;
  tapAt: number;
  lastMark: PerfPhase | null;
};

let enabled = false;
let current: InteractionSession | null = null;

function isPerfEnabled(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  if (process.env.NODE_ENV === "development") {
    return (
      process.env.NEXT_PUBLIC_HUI_PERF === "1" ||
      window.localStorage.getItem("hui_perf") === "1"
    );
  }
  return (
    window.localStorage.getItem("hui_perf") === "1" ||
    new URLSearchParams(window.location.search).get("hui_perf") === "1"
  );
}

function log(interaction: string, phase: PerfPhase, detail?: string) {
  if (!enabled) {
    return;
  }
  const suffix = detail ? ` ${detail}` : "";
  console.info(`[HUI PERF] interaction:${interaction} ${phase}${suffix}`);
}

export function initInteractionPerf(): void {
  enabled = isPerfEnabled();
  if (!enabled || typeof PerformanceObserver === "undefined") {
    return;
  }

  try {
    const longTask = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.duration >= 50) {
          console.info(
            `[HUI PERF] long-task ${Math.round(entry.duration)}ms start=${Math.round(entry.startTime)}`,
          );
        }
      }
    });
    longTask.observe({ type: "longtask", buffered: true });
  } catch {
    // longtask not supported in all browsers
  }

  try {
    const measure = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.entryType === "measure" && entry.name.startsWith("hui:")) {
          console.info(`[HUI PERF] ${entry.name} ${Math.round(entry.duration)}ms`);
        }
      }
    });
    measure.observe({ type: "measure", buffered: true });
  } catch {
    // ignore
  }
}

export function beginInteraction(interaction: string): void {
  if (!enabled) {
    enabled = isPerfEnabled();
  }
  if (!enabled) {
    return;
  }
  const tapAt = performance.now();
  current = { interaction, tapAt, lastMark: "tap" };
  const markName = `hui:${interaction}:tap`;
  performance.mark(markName);
  log(interaction, "tap");
}

export function markInteraction(
  interaction: string,
  phase: Exclude<PerfPhase, "total-tap-to-visible">,
  detail?: string,
): void {
  if (!enabled) {
    return;
  }
  const markName = `hui:${interaction}:${phase}`;
  performance.mark(markName);
  if (current?.interaction === interaction && current.tapAt) {
    const sinceTap = Math.round(performance.now() - current.tapAt);
    log(interaction, phase, `+${sinceTap}ms${detail ? ` ${detail}` : ""}`);
    if (phase === "optimistic-ui-visible" || phase === "usable-ui") {
      try {
        performance.measure(
          `hui:${interaction}:tap-to-${phase}`,
          `hui:${interaction}:tap`,
          markName,
        );
      } catch {
        // marks may be missing if beginInteraction was skipped
      }
      log(interaction, "total-tap-to-visible", `${sinceTap}ms`);
    }
  } else {
    log(interaction, phase, detail);
  }
  if (current?.interaction === interaction) {
    current.lastMark = phase;
  }
}

export function endInteraction(interaction: string): void {
  if (!enabled || current?.interaction !== interaction) {
    return;
  }
  current = null;
}
