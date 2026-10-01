import {
  isAuthEntryPath,
  isProtectedPath,
  sanitizeNextPath,
} from "./routes";

export type SessionGuardInput = {
  pathname: string;
  hasUser: boolean;
  nextParam?: string | null;
};

export type SessionGuardResult =
  | { action: "next" }
  | { action: "redirect"; location: string };

/** Pure routing rules for middleware session checks (unit-tested). */
export function resolveSessionGuard({
  pathname,
  hasUser,
  nextParam,
}: SessionGuardInput): SessionGuardResult {
  if (!hasUser && isProtectedPath(pathname)) {
    const next = encodeURIComponent(pathname);
    return { action: "redirect", location: `/sign-in?next=${next}` };
  }

  if (hasUser && isAuthEntryPath(pathname)) {
    return { action: "redirect", location: sanitizeNextPath(nextParam) };
  }

  return { action: "next" };
}
