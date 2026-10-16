/** Feature flags (env-backed). Off unless explicitly enabled. */

export function householdsEnabled(): boolean {
  return process.env.NEXT_PUBLIC_HUI_HOUSEHOLDS_ENABLED === "true";
}
