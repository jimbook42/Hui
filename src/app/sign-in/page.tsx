import Link from "next/link";

import { AuthPrimaryOAuth } from "@/components/auth/auth-primary-oauth";
import { AuthShell } from "@/components/auth/auth-shell";
import { getEnabledOAuthProviders } from "@/lib/auth/providers";
import { sanitizeNextPath } from "@/lib/auth/routes";
import { loadInviteGroupNameForAuthNext } from "@/lib/invites/auth-invite-context";
import { createClient } from "@/lib/supabase/server";

const OAUTH_SIGN_IN_MESSAGES: Record<string, string> = {
  cancelled:
    "Social sign-in was cancelled. You can try again or use email and password.",
  failed:
    "Social sign-in could not be completed. Try again or use email and password.",
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; oauth?: string; deleted?: string; deletion_incomplete?: string }>;
}) {
  const params = await searchParams;
  const accountDeleted = params.deleted === "1";
  const deletionIncomplete = params.deletion_incomplete === "1";
  const next = sanitizeNextPath(
    typeof params.next === "string" ? params.next : undefined,
  );
  const inviteGroupName =
    next !== "/dashboard" ? await loadInviteGroupNameForAuthNext(next) : null;
  const title = inviteGroupName ? `Sign in to join ${inviteGroupName}` : "Sign in";
  const description = inviteGroupName
    ? `Use your Hui account to join ${inviteGroupName} and answer the hui invite.`
    : "Choose how you want to sign in.";
  const oauthNotice =
    typeof params.oauth === "string"
      ? OAUTH_SIGN_IN_MESSAGES[params.oauth]
      : undefined;
  const providers = getEnabledOAuthProviders();

  if (accountDeleted) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      await supabase.auth.signOut({ scope: "global" });
    }
  }

  const signUpHref =
    next === "/dashboard" ? "/sign-up" : `/sign-up?next=${encodeURIComponent(next)}`;
  const emailSignInHref =
    next === "/dashboard" ? "/sign-in/email" : `/sign-in/email?next=${encodeURIComponent(next)}`;

  return (
    <AuthShell
      title={title}
      description={description}
      footer={
        <div className="space-y-2 text-center text-sm text-muted-foreground">
          <p>
            <Link href={emailSignInHref} className="font-medium underline-offset-4 hover:underline">
              Sign in with email
            </Link>
          </p>
          <p>
            <Link href="/privacy" className="font-medium underline-offset-4 hover:underline">
              Privacy policy
            </Link>
          </p>
        </div>
      }
    >
      {accountDeleted ? (
        <p className="hui-message-success mb-4" role="status">
          Your account was deleted. You can sign up again with the same email if you choose.
        </p>
      ) : null}
      {deletionIncomplete ? (
        <p className="hui-message-note mb-4" role="status">
          Your account deletion did not finish last time. Sign in and use Delete my account on
          your profile to try again.
        </p>
      ) : null}
      {oauthNotice ? (
        <p className="hui-message-note mb-4" role="status">
          {oauthNotice}
        </p>
      ) : null}
      <AuthPrimaryOAuth providers={providers} next={next} />
      <p className="mt-6 text-center text-sm text-muted-foreground">
        No account yet?{" "}
        <Link href={signUpHref} className="font-medium underline-offset-4 hover:underline">
          Sign up with email
        </Link>
      </p>
    </AuthShell>
  );
}
