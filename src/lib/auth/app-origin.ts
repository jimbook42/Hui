import { headers } from "next/headers";
import { type NextRequest } from "next/server";

function normalizeOrigin(value: string): string {
  return value.replace(/\/$/, "");
}

/** Optional override for OAuth redirect URLs (e.g. production canonical origin). */
export function getConfiguredAppOrigin(
  env: Record<string, string | undefined> = process.env,
): string | undefined {
  const configured = env.NEXT_PUBLIC_APP_URL?.trim();
  return configured ? normalizeOrigin(configured) : undefined;
}

/** Resolves the app origin for OAuth `redirectTo` from the incoming request headers. */
export async function resolveAuthRedirectOrigin(): Promise<string> {
  const configured = getConfiguredAppOrigin();
  if (configured) {
    return configured;
  }

  const headerStore = await headers();
  const host =
    headerStore.get("x-forwarded-host") ?? headerStore.get("host");
  if (!host) {
    throw new Error("Could not determine application origin for OAuth redirect.");
  }
  const protocol = headerStore.get("x-forwarded-proto") ?? "http";
  return `${protocol}://${host}`;
}

export function resolveAuthRedirectOriginFromRequest(
  request: NextRequest,
): string {
  const configured = getConfiguredAppOrigin();
  if (configured) {
    return configured;
  }

  const host =
    request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (host) {
    const protocol = request.headers.get("x-forwarded-proto") ?? "http";
    return `${protocol}://${host}`;
  }

  return new URL(request.url).origin;
}
