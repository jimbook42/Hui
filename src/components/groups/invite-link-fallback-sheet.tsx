"use client";

import { useCallback, useState } from "react";

import { copyInviteLink } from "@/domain/invites/share";
import { cn } from "@/lib/ui/cn";

type InviteLinkFallbackSheetProps = {
  open: boolean;
  inviteUrl: string;
  onClose: () => void;
  className?: string;
};

export function InviteLinkFallbackSheet({
  open,
  inviteUrl,
  onClose,
  className,
}: InviteLinkFallbackSheetProps) {
  const [feedback, setFeedback] = useState<string | null>(null);

  const showFeedback = useCallback((message: string) => {
    setFeedback(message);
    window.setTimeout(() => setFeedback(null), 4000);
  }, []);

  if (!open) {
    return null;
  }

  async function handleCopy() {
    const result = await copyInviteLink(inviteUrl);
    if (result.outcome === "copied") {
      showFeedback("Copied to clipboard.");
    } else if (result.outcome === "failed") {
      showFeedback(result.message);
    }
  }

  return (
    <div
      className={cn("fixed inset-0 z-50 flex items-end justify-center sm:items-center", className)}
      role="dialog"
      aria-modal="true"
      aria-labelledby="invite-link-sheet-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-foreground/40"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-md rounded-t-hui-2xl bg-surface px-5 pb-8 pt-5 hui-shadow-lg sm:rounded-hui-2xl sm:pb-6">
        <h2 id="invite-link-sheet-title" className="text-lg font-extrabold text-foreground">
          Share this invite link
        </h2>
        <p className="mt-1 text-sm font-semibold text-muted-foreground">
          Copy and send the link — they can join from any device.
        </p>
        <p className="mt-4 break-all rounded-hui-lg bg-muted px-3 py-3 text-sm font-semibold text-foreground">
          {inviteUrl}
        </p>
        {feedback ? (
          <p className="hui-message-success mt-2" role="status">{feedback}</p>
        ) : null}
        <div className="mt-5 flex flex-col gap-2">
          <button
            type="button"
            onClick={() => void handleCopy()}
            className="hui-btn hui-btn-primary rounded-full hui-focus-ring w-full"
          >
            Copy link
          </button>
          <button
            type="button"
            onClick={onClose}
            className="hui-btn hui-btn-secondary rounded-full hui-focus-ring w-full"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
