"use client";

import { GroupInviteIntroSheet } from "@/components/groups/group-invite-intro-sheet";
import { InviteLinkFallbackSheet } from "@/components/groups/invite-link-fallback-sheet";
import { useGroupInviteFlow } from "@/components/groups/use-group-invite-flow";
import { PeopleIcon } from "@/components/hui/icons";
import { buildGroupInviteUrl } from "@/domain/invites/urls";
import { cn } from "@/lib/ui/cn";

type GroupInviteShareBlockProps = {
  groupName: string;
  inviteToken: string;
  appOrigin: string;
  /** When set, invite link opens this hui after join. */
  focusEventId?: string;
  buttonLabel?: string;
  /** Primary hero card on the group tab (green surface). */
  variant?: "onPrimary" | "page" | "welcome" | "card";
  className?: string;
};

export function GroupInviteShareBlock({
  groupName,
  inviteToken,
  appOrigin,
  focusEventId,
  buttonLabel = "Invite",
  variant = "page",
  className,
}: GroupInviteShareBlockProps) {
  const inviteUrl = buildGroupInviteUrl(appOrigin, inviteToken, {
    focusEventId,
  });
  const {
    introOpen,
    fallbackOpen,
    getLinkPending,
    openIntro,
    closeIntro,
    closeFallback,
    getLink,
  } = useGroupInviteFlow(inviteUrl, groupName);

  const buttonClassName =
    variant === "onPrimary"
      ? "hui-focus-ring inline-flex min-h-11 items-center gap-2 rounded-full bg-[var(--accent-clay)] px-5 text-sm font-extrabold text-[#1a4331] hui-shadow-sm"
      : variant === "welcome"
        ? "hui-focus-ring inline-flex w-full min-h-14 items-center justify-center gap-2 rounded-full bg-primary px-6 text-base font-extrabold text-primary-foreground hui-shadow-md"
        : variant === "card"
          ? "hui-focus-ring relative z-10 inline-flex min-h-10 items-center gap-1.5 rounded-full border-2 border-border bg-surface px-4 text-sm font-extrabold text-foreground hui-shadow-sm"
          : "hui-focus-ring inline-flex min-h-11 items-center gap-2 rounded-full bg-primary px-5 text-sm font-extrabold text-primary-foreground hui-shadow-sm";

  const iconSize = variant === "welcome" ? 20 : 18;

  return (
    <>
      <button type="button" onClick={openIntro} className={cn(buttonClassName, className)}>
        <PeopleIcon size={iconSize} />
        {buttonLabel}
      </button>
      <GroupInviteIntroSheet
        open={introOpen}
        groupName={groupName}
        onClose={closeIntro}
        onGetLink={() => void getLink()}
        getLinkPending={getLinkPending}
      />
      <InviteLinkFallbackSheet
        open={fallbackOpen}
        inviteUrl={inviteUrl}
        onClose={closeFallback}
      />
    </>
  );
}
