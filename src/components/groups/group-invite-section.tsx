"use client";

import { useActionState, useCallback, useState } from "react";

import {
  regenerateGroupInviteLinkAction,
  type InviteActionState,
} from "@/app/groups/invite-actions";
import { InviteLinkFallbackSheet } from "@/components/groups/invite-link-fallback-sheet";
import { copyInviteLink, shareInviteLink } from "@/domain/invites/share";
import { buildGroupInviteUrl } from "@/domain/invites/urls";

const initialState: InviteActionState = {};

type GroupInviteSectionProps = {
  groupId: string;
  groupName?: string;
  inviteToken: string;
  appOrigin: string;
  /** Planning-first invite copy for first-hui onboarding. */
  variant?: "group" | "planning";
  invitePreviewHeadline?: string | null;
  /** When sharing from a specific gathering, keep invitees on that hui. */
  focusEventId?: string | null;
  /** Hide the section heading when a parent already provides one. */
  hideTitle?: boolean;
};

export function GroupInviteSection({
  groupId,
  groupName,
  inviteToken: initialToken,
  appOrigin,
  variant = "group",
  invitePreviewHeadline,
  focusEventId,
  hideTitle = false,
}: GroupInviteSectionProps) {
  const [feedback, setFeedback] = useState<string | null>(null);
  const [fallbackOpen, setFallbackOpen] = useState(false);
  const [sharePending, setSharePending] = useState(false);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [regenState, regenAction, regenPending] = useActionState(
    regenerateGroupInviteLinkAction,
    initialState,
  );

  const token = regenState.token ?? initialToken;
  const inviteUrl = buildGroupInviteUrl(appOrigin, token, { focusEventId });

  const showFeedback = useCallback((message: string) => {
    setFeedback(message);
    window.setTimeout(() => setFeedback(null), 4000);
  }, []);

  async function handleShare() {
    setSharePending(true);
    try {
      const result = await shareInviteLink(inviteUrl, groupName);
      if (result.outcome === "shared") {
        showFeedback("Share sheet opened.");
      } else if (result.outcome === "fallback") {
        setFallbackOpen(true);
      } else if (result.outcome === "cancelled") {
        return;
      } else if (result.outcome === "failed") {
        showFeedback(result.message);
      }
    } finally {
      setSharePending(false);
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

  const joinCopy =
    variant === "planning"
      ? "Share this link so people can join the group and help plan this hui."
      : "Share this link so people can join the group.";

  return (
    <section className="hui-card-section">
      {hideTitle ? null : (
        <h2 className="hui-type-section text-foreground">
          {variant === "planning" ? "Invite people to this hui" : "Invite people"}
        </h2>
      )}
      <p className="mt-1 text-sm text-muted-foreground">{joinCopy}</p>
      {invitePreviewHeadline ? (
        <p className="mt-3 rounded-hui-md bg-muted px-3 py-2 text-sm font-semibold text-foreground">
          {invitePreviewHeadline}
        </p>
      ) : null}

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
          disabled={sharePending}
          className="hui-btn hui-btn-primary rounded-full hui-focus-ring"
        >
          {sharePending ? "Opening…" : "Share invite"}
        </button>
        <button
          type="button"
          onClick={() => void handleCopy()}
          className="hui-btn hui-btn-secondary rounded-full hui-focus-ring"
        >
          Copy link
        </button>
      </div>

      <div className="mt-4">
        {resetConfirmOpen ? (
          <div className="rounded-hui-lg border border-border bg-muted/40 px-4 py-3">
            <p className="text-sm font-semibold text-foreground">
              Reset the invite link? The old link stops working straight away.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <form action={regenAction} className="inline">
                <input type="hidden" name="group_id" value={groupId} />
                <button
                  type="submit"
                  disabled={regenPending}
                  className="hui-btn hui-btn-primary rounded-full hui-focus-ring text-sm"
                >
                  {regenPending ? "Resetting…" : "Yes, reset link"}
                </button>
              </form>
              <button
                type="button"
                onClick={() => setResetConfirmOpen(false)}
                className="hui-btn hui-btn-secondary rounded-full hui-focus-ring text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setResetConfirmOpen(true)}
            className="text-sm font-semibold text-muted-foreground underline-offset-2 hover:underline hui-focus-ring rounded"
          >
            Reset link
          </button>
        )}
      </div>

      <InviteLinkFallbackSheet
        open={fallbackOpen}
        inviteUrl={inviteUrl}
        onClose={() => setFallbackOpen(false)}
      />
    </section>
  );
}
