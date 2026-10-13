import packageJson from "../../../package.json";

import { buildStamp } from "@/lib/build/stamp";

/** Semantic version from package.json (release source of truth). */
export function appVersion(): string {
  return packageJson.version;
}

/** Support-friendly label: product version plus deployed commit. */
export function appVersionLine(): string {
  return `Hui v${appVersion()} · ${buildStamp()}`;
}
