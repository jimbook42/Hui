"use client";

import { useCallback, useState } from "react";

import { PeopleIcon } from "@/components/hui/icons";
import { shareOrCopyInviteLink } from "@/domain/invites/share";
import { buildGroupInviteUrl } from "@/domain/invites/urls";
import { cn } from "@/lib/ui/cn";

type GroupInviteFriendsButtonProps = {
  groupName: string;
  inviteToken: string;
  appOrigin: string;
  className?: string;
  size?: "default" | "touch";
};

export function GroupInviteFriendsButton({
  groupName,
  inviteToken,
  appOrigin,
  className,
  size = "touch",
}: GroupInviteFriendsButtonProps) {
  const [feedback, setFeedback] = useState<string | null>(null);
  const inviteUrl = buildGroupInviteUrl(appOrigin, inviteToken);

  const showFeedback = useCallback((message: string) => {
    setFeedback(message);
    window.setTimeout(() => setFeedback(null), 4000);
  }, []);

  async function handleInvite() {
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

  return (
    <div className={cn("space-y-2", className)}>
      <button
        type="button"
        onClick={() => void handleInvite()}
        className={cn(
          "hui-focus-ring inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary font-extrabold text-primary-foreground hui-shadow-md",
          size === "touch" ? "min-h-14 px-6 text-base" : "min-h-11 px-5 text-sm",
        )}
      >
        <PeopleIcon size={20} />
        Invite friends
      </button>
      {feedback ? (
        <p className="text-center text-sm font-semibold text-muted-foreground" role="status">
          {feedback}
        </p>
      ) : null}
    </div>
  );
}
