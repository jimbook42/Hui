import "server-only";

const enabled =
  process.env.NODE_ENV !== "production" && process.env.HUI_DEV_PERF === "1";

export async function devTimed<T>(
  label: string,
  work: () => Promise<T>,
): Promise<T> {
  if (!enabled) {
    return work();
  }
  const start = performance.now();
  try {
    return await work();
  } finally {
    const ms = Math.round(performance.now() - start);
    console.info(`[hui-perf] ${label}: ${ms}ms`);
  }
}
