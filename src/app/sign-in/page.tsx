import Link from "next/link";

import { signInAction } from "@/app/auth/actions";
import { AuthField, AuthForm } from "@/components/auth/auth-form";
import { AuthOAuthSection } from "@/components/auth/auth-provider-options";
import { AuthShell } from "@/components/auth/auth-shell";
import { sanitizeNextPath } from "@/lib/auth/routes";

const OAUTH_SIGN_IN_MESSAGES: Record<string, string> = {
  cancelled:
    "Social sign-in was cancelled. You can try again or use email and password.",
  failed:
    "Social sign-in could not be completed. Try again or use email and password.",
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; oauth?: string; deleted?: string }>;
}) {
  const params = await searchParams;
  const accountDeleted = params.deleted === "1";
  const next = sanitizeNextPath(
    typeof params.next === "string" ? params.next : undefined,
  );
  const oauthNotice =
    typeof params.oauth === "string"
      ? OAUTH_SIGN_IN_MESSAGES[params.oauth]
      : undefined;

  return (
    <AuthShell
      title="Sign in"
      description="Use your email and password to access your Hui account."
      footer={
        <>
          No account yet?{" "}
          <Link href="/sign-up" className="font-medium underline-offset-4 hover:underline">
            Sign up
          </Link>
        </>
      }
    >
      {accountDeleted ? (
        <p className="mb-4 text-sm text-emerald-800 dark:text-emerald-300" role="status">
          Your account was deleted. You can sign up again with the same email if you choose.
        </p>
      ) : null}
      {oauthNotice ? (
        <p className="mb-4 text-sm text-amber-800 dark:text-amber-200" role="status">
          {oauthNotice}
        </p>
      ) : null}
      <AuthOAuthSection next={next} />
      <AuthForm action={signInAction} submitLabel="Sign in" hiddenFields={{ next }}>
        <AuthField label="Email" name="email" type="email" autoComplete="email" />
        <AuthField
          label="Password"
          name="password"
          type="password"
          autoComplete="current-password"
        />
      </AuthForm>
    </AuthShell>
  );
}
