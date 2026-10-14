"use client";

import { GroupInviteShareBlock } from "@/components/groups/group-invite-share-block";

type GroupInviteHeroButtonProps = {
  groupName: string;
  inviteToken: string;
  appOrigin: string;
};

/** @deprecated Prefer GroupInviteShareBlock */
export function GroupInviteHeroButton(props: GroupInviteHeroButtonProps) {
  return <GroupInviteShareBlock {...props} variant="onPrimary" />;
}
