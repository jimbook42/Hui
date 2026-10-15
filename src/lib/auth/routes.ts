/** Routes that require an authenticated Supabase session. */
export const PROTECTED_ROUTE_PREFIXES = [
  "/dashboard",
  "/profile",
  "/groups",
  "/events",
  "/notifications",
] as const;

/** Auth entry routes; signed-in users are redirected away. */
export const AUTH_ENTRY_ROUTES = ["/sign-in", "/sign-up"] as const;

export const DEFAULT_POST_AUTH_PATH = "/dashboard";

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

function pathnameOfNext(path: string): string {
  const query = path.indexOf("?");
  const hash = path.indexOf("#");
  let end = path.length;
  if (query !== -1) {
    end = query;
  }
  if (hash !== -1 && hash < end) {
    end = hash;
  }
  return path.slice(0, end);
}

function decodeNextInput(raw: string): string {
  let value = raw.trim();
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const decoded = decodeURIComponent(value);
      if (decoded === value) {
        break;
      }
      value = decoded;
    } catch {
      break;
    }
  }
  return value;
}

function isUnsafeNextPath(path: string): boolean {
  if (!path.startsWith("/")) {
    return true;
  }
  if (path.startsWith("//")) {
    return true;
  }
  if (path.includes("\\") || path.includes("/\\")) {
    return true;
  }
  if (path.includes("://")) {
    return true;
  }
  if (/^\/[a-z][a-z0-9+.-]*:/i.test(path)) {
    return true;
  }
  const prefix = path.slice(0, 16).toLowerCase();
  if (prefix.includes("%2f%2f") || prefix.includes("%5c")) {
    return true;
  }
  return false;
}

export function sanitizeNextPath(next: string | null | undefined): string {
  if (!next) {
    return DEFAULT_POST_AUTH_PATH;
  }
  const decoded = decodeNextInput(next);
  if (!decoded || isUnsafeNextPath(decoded)) {
    return DEFAULT_POST_AUTH_PATH;
  }
  if (isAuthEntryPath(pathnameOfNext(decoded))) {
    return DEFAULT_POST_AUTH_PATH;
  }
  return decoded;
}

/** Build an auth route URL that preserves a safe post-login `next` path. */
export function authPathWithNext(
  path: string,
  next: string | null | undefined,
): string {
  const safe = sanitizeNextPath(next);
  if (safe === DEFAULT_POST_AUTH_PATH) {
    return path;
  }
  const url = new URL(path, "http://hui.local");
  url.searchParams.set("next", safe);
  return `${url.pathname}${url.search}`;
}
