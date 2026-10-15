import Link from "next/link";

import { EmailSignInForm } from "@/components/auth/email-sign-in-form";
import { AuthShell } from "@/components/auth/auth-shell";
import { authPathWithNext, sanitizeNextPath } from "@/lib/auth/routes";

export default async function EmailSignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  const next = sanitizeNextPath(
    typeof params.next === "string" ? params.next : undefined,
  );
  const signInHref = authPathWithNext("/sign-in", next);
  const signUpHref = authPathWithNext("/sign-up", next);

  return (
    <AuthShell
      title="Sign in with email"
      description="Use the email and password for your Hui account."
      footer={
        <div className="space-y-2 text-center text-sm text-muted-foreground">
          <p>
            <Link href={signInHref} className="font-medium underline-offset-4 hover:underline">
              Back to sign-in options
            </Link>
          </p>
          <p>
            No account yet?{" "}
            <Link href={signUpHref} className="font-medium underline-offset-4 hover:underline">
              Sign up with email
            </Link>
          </p>
        </div>
      }
    >
      <EmailSignInForm next={next} />
    </AuthShell>
  );
}
