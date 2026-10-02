import { type NextRequest, NextResponse } from "next/server";

import { oauthCallbackFailureReason } from "@/lib/auth/oauth";
import { sanitizeNextPath } from "@/lib/auth/routes";
import { ensureUserProfile } from "@/lib/profiles/ensure-profile";
import { initialDisplayNameFromAuthMetadata } from "@/lib/profiles/initial-display-name";
import { createClient } from "@/lib/supabase/server";

function redirectToSignIn(
  request: NextRequest,
  reason: "cancelled" | "failed",
): NextResponse {
  const url = new URL("/sign-in", request.url);
  url.searchParams.set("oauth", reason);
  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);

  const oauthError = requestUrl.searchParams.get("error");
  if (oauthError) {
    return redirectToSignIn(request, oauthCallbackFailureReason(oauthError));
  }

  const code = requestUrl.searchParams.get("code");
  if (!code) {
    return redirectToSignIn(request, "failed");
  }

  const next = sanitizeNextPath(requestUrl.searchParams.get("next"));
  const supabase = await createClient();
  const { error: exchangeError } =
    await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError) {
    return redirectToSignIn(request, "failed");
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return redirectToSignIn(request, "failed");
  }

  const ensured = await ensureUserProfile(
    supabase,
    user.id,
    initialDisplayNameFromAuthMetadata(user.user_metadata, user.email),
  );
  if (!ensured.ok) {
    return redirectToSignIn(request, "failed");
  }

  return NextResponse.redirect(new URL(next, requestUrl.origin));
}
