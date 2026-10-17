import { type NextRequest, NextResponse } from "next/server";

import { oauthCallbackFailureReason } from "@/lib/auth/oauth";
import { sanitizeNextPath } from "@/lib/auth/routes";
import { ensureUserProfile } from "@/lib/profiles/ensure-profile";
import { shouldPromptForDisplayName } from "@/lib/profiles/display-name-prompt";
import { initialDisplayNameFromAuthMetadata } from "@/lib/profiles/initial-display-name";
import { createClient } from "@/lib/supabase/server";

function redirectToSignIn(
  request: NextRequest,
  reason: "cancelled" | "failed",
  nextParam?: string | null,
): NextResponse {
  const url = new URL("/sign-in", request.url);
  url.searchParams.set("oauth", reason);
  const next = sanitizeNextPath(nextParam);
  if (next !== "/dashboard") {
    url.searchParams.set("next", next);
  }
  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);

  const rawNext = requestUrl.searchParams.get("next");
  const next = sanitizeNextPath(rawNext);

  const oauthError = requestUrl.searchParams.get("error");
  if (oauthError) {
    return redirectToSignIn(request, oauthCallbackFailureReason(oauthError), rawNext);
  }

  const code = requestUrl.searchParams.get("code");
  if (!code) {
    return redirectToSignIn(request, "failed", rawNext);
  }
  const supabase = await createClient();
  const { error: exchangeError } =
    await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError) {
    return redirectToSignIn(request, "failed", rawNext);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return redirectToSignIn(request, "failed", rawNext);
  }

  const ensured = await ensureUserProfile(
    supabase,
    user.id,
    initialDisplayNameFromAuthMetadata(user.user_metadata, user.email),
  );
  if (!ensured.ok) {
    return redirectToSignIn(request, "failed", rawNext);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .maybeSingle();

  if (
    shouldPromptForDisplayName({
      displayName: profile?.display_name,
      email: user.email,
      userMetadata: user.user_metadata,
    })
  ) {
    return NextResponse.redirect(new URL("/profile/display-name", requestUrl.origin));
  }

  return NextResponse.redirect(new URL(next, requestUrl.origin));
}
