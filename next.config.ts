import { execSync } from "node:child_process";

import { withSerwist } from "@serwist/turbopack";
import type { NextConfig } from "next";

function localGitSha(): string | undefined {
  if (process.env.VERCEL_GIT_COMMIT_SHA || process.env.NEXT_PUBLIC_HUI_BUILD_SHA) {
    return undefined;
  }
  try {
    return execSync("git rev-parse --short HEAD", { encoding: "utf8" }).trim();
  } catch {
    return undefined;
  }
}

const buildSha =
  process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ??
  process.env.NEXT_PUBLIC_HUI_BUILD_SHA ??
  localGitSha() ??
  "dev";

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_HUI_BUILD_SHA: buildSha,
  },
};

export default withSerwist(nextConfig);
