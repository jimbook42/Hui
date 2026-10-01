/** Routes that require an authenticated Supabase session. */
export const PROTECTED_ROUTE_PREFIXES = ["/dashboard", "/profile", "/groups"] as const;

/** Auth entry routes; signed-in users are redirected away. */
export const AUTH_ENTRY_ROUTES = ["/sign-in", "/sign-up"] as const;

export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function isAuthEntryPath(pathname: string): boolean {
  return AUTH_ENTRY_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
}

export function sanitizeNextPath(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) {
    return "/dashboard";
  }
  if (isAuthEntryPath(next)) {
    return "/dashboard";
  }
  return next;
}
