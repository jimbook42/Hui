"use client";

import { useCallback, useState } from "react";

import { shareOrCopyInviteLink } from "@/domain/invites/share";
import { buildGroupInviteUrl } from "@/domain/invites/urls";
import { PeopleIcon } from "@/components/hui/icons";

type GroupInviteHeroButtonProps = {
  groupName: string;
  inviteToken: string;
  appOrigin: string;
};

export function GroupInviteHeroButton({
  groupName,
  inviteToken,
  appOrigin,
}: GroupInviteHeroButtonProps) {
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
    <div className="relative">
      <button
        type="button"
        onClick={() => void handleInvite()}
        className="hui-focus-ring inline-flex min-h-11 items-center gap-2 rounded-full bg-[var(--accent-clay)] px-5 text-sm font-extrabold text-[#1a4331] hui-shadow-sm"
      >
        <PeopleIcon size={18} />
        Invite
      </button>
      {feedback ? (
        <p className="absolute left-0 top-full z-10 mt-2 whitespace-nowrap text-xs font-semibold text-primary-foreground/90" role="status">
          {feedback}
        </p>
      ) : null}
    </div>
  );
}
