import Link from "next/link";

import { signUpAction } from "@/app/auth/actions";
import { AuthField, AuthForm } from "@/components/auth/auth-form";
import { AuthOAuthSection } from "@/components/auth/auth-provider-options";
import { AuthShell } from "@/components/auth/auth-shell";
import { sanitizeNextPath } from "@/lib/auth/routes";

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  const next = sanitizeNextPath(
    typeof params.next === "string" ? params.next : undefined,
  );

  return (
    <AuthShell
      title="Create your account"
      description="We will send a verification email before your first sign-in."
      footer={
        <>
          Already have an account?{" "}
          <Link
            href={next === "/dashboard" ? "/sign-in" : `/sign-in?next=${encodeURIComponent(next)}`}
            className="font-medium underline-offset-4 hover:underline"
          >
            Sign in
          </Link>
        </>
      }
    >
      <AuthOAuthSection next={next} />
      <AuthForm action={signUpAction} submitLabel="Sign up" hiddenFields={{ next }}>
        <AuthField
          label="Display name"
          name="display_name"
          autoComplete="name"
        />
        <AuthField label="Email" name="email" type="email" autoComplete="email" />
        <AuthField
          label="Password"
          name="password"
          type="password"
          autoComplete="new-password"
        />
        <p className="text-xs text-muted-foreground">Use at least 8 characters.</p>
      </AuthForm>
    </AuthShell>
  );
}
