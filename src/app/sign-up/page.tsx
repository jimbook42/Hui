import Link from "next/link";

import { AuthPrimaryOAuth } from "@/components/auth/auth-primary-oauth";
import { EmailSignUpForm } from "@/components/auth/email-sign-up-form";
import { AuthShell } from "@/components/auth/auth-shell";
import { getEnabledOAuthProviders } from "@/lib/auth/providers";
import { authPathWithNext, sanitizeNextPath } from "@/lib/auth/routes";
import { loadInviteGroupNameForAuthNext } from "@/lib/invites/auth-invite-context";

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  const next = sanitizeNextPath(
    typeof params.next === "string" ? params.next : undefined,
  );
  const inviteGroupName =
    next !== "/dashboard" ? await loadInviteGroupNameForAuthNext(next) : null;
  const title = inviteGroupName
    ? `Create account to join ${inviteGroupName}`
    : "Sign up with email";
  const description = inviteGroupName
    ? `We'll set up your Hui account so you can join ${inviteGroupName}.`
    : "Create your Hui account with email and password.";
  const providers = getEnabledOAuthProviders();
  const signInHref = authPathWithNext("/sign-in", next);
  const emailSignInHref = authPathWithNext("/sign-in/email", next);

  return (
    <AuthShell
      title={title}
      description={description}
      footer={
        <div className="space-y-2 text-center text-sm text-muted-foreground">
          <p>
            Already have an account?{" "}
            <Link href={signInHref} className="font-medium underline-offset-4 hover:underline">
              Sign in
            </Link>
          </p>
          <p>
            <Link
              href={emailSignInHref}
              className="font-medium underline-offset-4 hover:underline"
            >
              Sign in with email
            </Link>
          </p>
        </div>
      }
    >
      <AuthPrimaryOAuth providers={providers} next={next} />
      <p className="my-6 text-center text-sm text-muted-foreground">or create account with email</p>
      <EmailSignUpForm next={next} />
    </AuthShell>
  );
}
