"use client";

import {
  GROUP_INVITE_GROUP_ACCESS_NOTE,
  GROUP_INVITE_HUI_ACCESS_NOTE,
} from "@/domain/invites/copy";
import { cn } from "@/lib/ui/cn";

type GroupInviteIntroSheetProps = {
  open: boolean;
  groupName?: string;
  /** When sharing from a hui page, name the hui in the title and note. */
  focusHuiTitle?: string | null;
  onClose: () => void;
  onGetLink: () => void;
  getLinkPending?: boolean;
  className?: string;
};

export function GroupInviteIntroSheet({
  open,
  groupName,
  focusHuiTitle,
  onClose,
  onGetLink,
  getLinkPending = false,
  className,
}: GroupInviteIntroSheetProps) {
  if (!open) {
    return null;
  }

  const trimmedHui = focusHuiTitle?.trim();
  const trimmedGroup = groupName?.trim();
  const title = trimmedHui
    ? `Invite to ${trimmedHui}`
    : trimmedGroup
      ? `Invite to ${trimmedGroup}`
      : "Invite to group";
  const accessNote = trimmedHui ? GROUP_INVITE_HUI_ACCESS_NOTE : GROUP_INVITE_GROUP_ACCESS_NOTE;

  return (
    <div
      className={cn("fixed inset-0 z-50 flex items-end justify-center sm:items-center", className)}
      role="dialog"
      aria-modal="true"
      aria-labelledby="group-invite-intro-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-foreground/40"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-md rounded-t-hui-2xl bg-surface px-5 pb-[calc(5.5rem+env(safe-area-inset-bottom))] pt-5 hui-shadow-lg sm:rounded-hui-2xl sm:pb-6">
        <h2 id="group-invite-intro-title" className="text-lg font-extrabold text-foreground">
          {title}
        </h2>
        {trimmedHui && trimmedGroup ? (
          <p className="mt-1 text-sm font-semibold text-muted-foreground">Group: {trimmedGroup}</p>
        ) : null}
        <p className="mt-3 text-sm font-semibold leading-snug text-muted-foreground">
          {accessNote}
        </p>
        <div className="mt-6 flex flex-col gap-2">
          <button
            type="button"
            disabled={getLinkPending}
            onClick={onGetLink}
            className="hui-btn hui-btn-primary rounded-full hui-focus-ring w-full disabled:opacity-60"
          >
            {getLinkPending ? "Opening…" : "Get link"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="hui-btn hui-btn-secondary rounded-full hui-focus-ring w-full"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
