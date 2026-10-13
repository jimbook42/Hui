/** Short git SHA for support and QA (injected at build time on Vercel). */
export function buildStamp(): string {
  const sha =
    process.env.NEXT_PUBLIC_HUI_BUILD_SHA ??
    process.env.VERCEL_GIT_COMMIT_SHA ??
    "dev";
  return sha.length > 7 ? sha.slice(0, 7) : sha;
}
