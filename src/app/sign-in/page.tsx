import Link from "next/link";

import { signInAction } from "@/app/auth/actions";
import { AuthField, AuthForm } from "@/components/auth/auth-form";
import { AuthOAuthSection } from "@/components/auth/auth-provider-options";
import { AuthShell } from "@/components/auth/auth-shell";
import { sanitizeNextPath } from "@/lib/auth/routes";

export default async function SignInPage({
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
      <AuthOAuthSection />
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
