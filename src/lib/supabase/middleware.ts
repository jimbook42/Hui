import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

import { resolveSessionGuard } from "@/lib/auth/middleware-guard";

import { getPublicSupabaseConfig } from "./env";

function applyCookies(
  target: NextResponse,
  source: NextResponse,
): NextResponse {
  source.cookies.getAll().forEach((cookie) => {
    target.cookies.set(cookie.name, cookie.value, cookie);
  });
  return target;
}

/** Refreshes the auth session cookie and enforces route guards. */
export async function updateSession(request: NextRequest) {
  const { url, publishableKey } = getPublicSupabaseConfig();

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          supabaseResponse.cookies.set(name, value, options);
        });
      },
    },
  });

  let hasUser = false;
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    hasUser = Boolean(user);
  } catch {
    hasUser = false;
  }

  const guard = resolveSessionGuard({
    pathname: request.nextUrl.pathname,
    hasUser,
    nextParam: request.nextUrl.searchParams.get("next"),
  });

  if (guard.action === "redirect") {
    const redirectUrl = new URL(guard.location, request.url);
    const redirectResponse = NextResponse.redirect(redirectUrl);
    return applyCookies(redirectResponse, supabaseResponse);
  }

  return supabaseResponse;
}
