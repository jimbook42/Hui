/** Feature flags (env-backed). Off unless explicitly enabled. */

export function householdsEnabled(): boolean {
  return process.env.NEXT_PUBLIC_HUI_HOUSEHOLDS_ENABLED === "true";
}

/** Profile hub copy for the Hui groups row (respects households flag). */
export function profileHuiGroupsDescription(): string {
  return householdsEnabled()
    ? "Households and how you appear in each group"
    : "How you appear in each group";
}
