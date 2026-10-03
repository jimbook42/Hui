import Link from "next/link";

import { JoinAuthLinks, JoinInviteButton } from "@/components/join/join-invite-actions";
import { parseInviteResolvePayload } from "@/domain/invites/resolve";
import { createClient } from "@/lib/supabase/server";

type PageProps = {
  params: Promise<{ token: string }>;
};

export default async function JoinInvitePage({ params }: PageProps) {
  const { token } = await params;
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("resolve_group_invite", {
    p_token: token,
  });

  const resolved = error ? { status: "invalid" as const } : parseInviteResolvePayload(data);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-12">
      <p className="text-sm font-medium text-zinc-500">Hui</p>

      {resolved.status === "invalid" ? (
        <>
          <h1 className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            Invite not valid
          </h1>
          <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
            This invite link is no longer valid.
          </p>
          <Link
            href={user ? "/dashboard" : "/sign-in"}
            className="mt-8 text-sm font-medium text-zinc-900 underline-offset-4 hover:underline dark:text-zinc-100"
          >
            {user ? "Back to dashboard" : "Sign in to Hui"}
          </Link>
        </>
      ) : null}

      {resolved.status === "already_member" ? (
        <>
          <h1 className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            Already a member
          </h1>
          <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
            You&apos;re already a member of{" "}
            <span className="font-medium text-zinc-900 dark:text-zinc-100">
              {resolved.groupName}
            </span>
            .
          </p>
          <Link
            href={`/groups/${resolved.groupId}`}
            className="mt-8 inline-flex justify-center rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900"
          >
            Open Hui
          </Link>
        </>
      ) : null}

      {resolved.status === "valid" ? (
        <>
          <h1 className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            You&apos;re invited
          </h1>
          <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
            You&apos;re invited to join{" "}
            <span className="font-medium text-zinc-900 dark:text-zinc-100">
              {resolved.groupName}
            </span>
            .
          </p>
          {user ? (
            <div className="mt-8 max-w-sm">
              <JoinInviteButton token={token} />
            </div>
          ) : (
            <JoinAuthLinks token={token} />
          )}
        </>
      ) : null}
    </main>
  );
}
