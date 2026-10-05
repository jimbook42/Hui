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
  groupName?: string;
  inviteToken: string;
  appOrigin: string;
};

export function GroupInviteSection({
  groupId,
  groupName,
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
    const result = await shareOrCopyInviteLink(inviteUrl, groupName);
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
    <section className="hui-card-section">
      <h2 className="hui-type-section text-foreground">
        Invite people
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Share this link with anyone you&apos;d like to join this group.
      </p>

      <p className="mt-4 break-all rounded-hui-md bg-muted px-3 py-2 text-sm text-foreground">
        {inviteUrl}
      </p>

      {feedback ? (
        <p className="hui-message-success mt-2" role="status">
          {feedback}
        </p>
      ) : null}
      {regenState.error ? (
        <p className="hui-message-error mt-2" role="alert">
          {regenState.error}
        </p>
      ) : null}
      {regenState.message ? (
        <p className="hui-message-success mt-2" role="status">
          {regenState.message}
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => void handleShare()}
          className="hui-btn hui-btn-primary rounded-full hui-focus-ring"
        >
          Share invite
        </button>
        <button
          type="button"
          onClick={() => void handleCopy()}
          className="hui-btn hui-btn-secondary rounded-full hui-focus-ring"
        >
          Copy invite link
        </button>
        <form action={regenAction} className="inline">
          <input type="hidden" name="group_id" value={groupId} />
          <button
            type="submit"
            disabled={regenPending}
            className="hui-btn hui-btn-secondary rounded-full hui-focus-ring"
          >
            {regenPending ? "Regenerating…" : "Regenerate link"}
          </button>
        </form>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Regenerating invalidates the previous link immediately.
      </p>
    </section>
  );
}
