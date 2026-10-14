import Link from "next/link";

import { EmailSignUpForm } from "@/components/auth/email-sign-up-form";
import { AuthShell } from "@/components/auth/auth-shell";
import { sanitizeNextPath } from "@/lib/auth/routes";
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

  return (
    <AuthShell
      title={title}
      description={description}
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
      <EmailSignUpForm next={next} />
    </AuthShell>
  );
}
