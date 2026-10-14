"use client";

import { GroupInviteShareBlock } from "@/components/groups/group-invite-share-block";
import { cn } from "@/lib/ui/cn";

type GroupInviteFriendsButtonProps = {
  groupName: string;
  inviteToken: string;
  appOrigin: string;
  className?: string;
  size?: "default" | "touch";
};

export function GroupInviteFriendsButton({
  className,
  size = "touch",
  ...props
}: GroupInviteFriendsButtonProps) {
  return (
    <GroupInviteShareBlock
      {...props}
      variant="welcome"
      buttonLabel="Invite friends"
      className={cn(size === "default" && "[&_button]:min-h-11 [&_button]:text-sm", className)}
    />
  );
}
