import "server-only";

import { readVapidConfig, type VapidConfig } from "./vapid-env";

export type { VapidConfig };

export function getVapidConfig(
  env: Record<string, string | undefined> = process.env,
): VapidConfig | null {
  return readVapidConfig(env);
}

export function getVapidPublicKey(
  env: Record<string, string | undefined> = process.env,
): string | null {
  return readVapidConfig(env)?.publicKey ?? null;
}
