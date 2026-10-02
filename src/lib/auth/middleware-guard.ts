import {
  isAuthEntryPath,
  isProtectedPath,
  sanitizeNextPath,
} from "./routes";

export type SessionGuardInput = {
  pathname: string;
  hasUser: boolean;
  nextParam?: string | null;
  /** When `1`, allow sign-in so post-deletion sign-out can complete. */
  accountDeletedParam?: string | null;
};

export type SessionGuardResult =
  | { action: "next" }
  | { action: "redirect"; location: string };

/** Pure routing rules for middleware session checks (unit-tested). */
export function resolveSessionGuard({
  pathname,
  hasUser,
  nextParam,
  accountDeletedParam,
}: SessionGuardInput): SessionGuardResult {
  if (!hasUser && isProtectedPath(pathname)) {
    const next = encodeURIComponent(pathname);
    return { action: "redirect", location: `/sign-in?next=${next}` };
  }

  if (hasUser && isAuthEntryPath(pathname)) {
    if (pathname === "/sign-in" && accountDeletedParam === "1") {
      return { action: "next" };
    }
    return { action: "redirect", location: sanitizeNextPath(nextParam) };
  }

  return { action: "next" };
}
