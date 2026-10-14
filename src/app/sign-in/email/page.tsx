import Link from "next/link";

import { EmailSignInForm } from "@/components/auth/email-sign-in-form";
import { AuthShell } from "@/components/auth/auth-shell";
import { sanitizeNextPath } from "@/lib/auth/routes";

export default async function EmailSignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  const next = sanitizeNextPath(
    typeof params.next === "string" ? params.next : undefined,
  );
  const signInHref =
    next === "/dashboard" ? "/sign-in" : `/sign-in?next=${encodeURIComponent(next)}`;

  return (
    <AuthShell
      title="Sign in with email"
      description="Use the email and password for your Hui account."
      footer={
        <Link href={signInHref} className="font-medium underline-offset-4 hover:underline">
          Back to sign-in options
        </Link>
      }
    >
      <EmailSignInForm next={next} />
    </AuthShell>
  );
}
