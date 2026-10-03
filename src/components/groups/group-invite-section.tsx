"use client";

import { useActionState, useCallback, useState } from "react";

import {
  regenerateGroupInviteLinkAction,
  type InviteActionState,
} from "@/app/groups/invite-actions";
import { copyInviteLink, shareOrCopyInviteLink } from "@/domain/invites/share";
import { buildGroupInviteUrl } from "@/domain/invites/urls";

const initialState: InviteActionState = {};

type GroupInviteSectionProps = {
  groupId: string;
  inviteToken: string;
  appOrigin: string;
};

export function GroupInviteSection({
  groupId,
  inviteToken: initialToken,
  appOrigin,
}: GroupInviteSectionProps) {
  const [feedback, setFeedback] = useState<string | null>(null);
  const [regenState, regenAction, regenPending] = useActionState(
    regenerateGroupInviteLinkAction,
    initialState,
  );

  const token = regenState.token ?? initialToken;
  const inviteUrl = buildGroupInviteUrl(appOrigin, token);

  const showFeedback = useCallback((message: string) => {
    setFeedback(message);
    window.setTimeout(() => setFeedback(null), 4000);
  }, []);

  async function handleShare() {
    const result = await shareOrCopyInviteLink(inviteUrl);
    if (result.outcome === "shared") {
      showFeedback("Share sheet opened.");
    } else if (result.outcome === "copied") {
      showFeedback("Invite link copied.");
    } else if (result.outcome === "cancelled") {
      return;
    } else if (result.outcome === "failed") {
      showFeedback(result.message);
    }
  }

  async function handleCopy() {
    const result = await copyInviteLink(inviteUrl);
    if (result.outcome === "copied") {
      showFeedback("Invite link copied.");
    } else if (result.outcome === "failed") {
      showFeedback(result.message);
    }
  }

  return (
    <section className="mt-10">
      <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
        Invite people
      </h2>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Share this link with anyone you&apos;d like to join this Hui.
      </p>

      <p className="mt-4 break-all rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
        {inviteUrl}
      </p>

      {feedback ? (
        <p className="mt-2 text-sm text-emerald-700 dark:text-emerald-400" role="status">
          {feedback}
        </p>
      ) : null}
      {regenState.error ? (
        <p className="mt-2 text-sm text-red-600 dark:text-red-400" role="alert">
          {regenState.error}
        </p>
      ) : null}
      {regenState.message ? (
        <p className="mt-2 text-sm text-emerald-700 dark:text-emerald-400" role="status">
          {regenState.message}
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => void handleShare()}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          Share invite
        </button>
        <button
          type="button"
          onClick={() => void handleCopy()}
          className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-100 dark:hover:bg-zinc-900"
        >
          Copy invite link
        </button>
        <form action={regenAction} className="inline">
          <input type="hidden" name="group_id" value={groupId} />
          <button
            type="submit"
            disabled={regenPending}
            className="rounded-lg border border-amber-300 px-4 py-2 text-sm font-medium text-amber-900 hover:bg-amber-50 disabled:opacity-60 dark:border-amber-800 dark:text-amber-200 dark:hover:bg-amber-950/40"
          >
            {regenPending ? "Regenerating…" : "Regenerate link"}
          </button>
        </form>
      </div>
      <p className="mt-2 text-xs text-zinc-500">
        Regenerating invalidates the previous link immediately.
      </p>
    </section>
  );
}
