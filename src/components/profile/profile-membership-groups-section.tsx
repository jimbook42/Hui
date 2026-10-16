import Link from "next/link";

import type { UserMembershipGroup } from "@/lib/groups/user-membership-groups";

type ProfileMembershipGroupsSectionProps = {
  groups: UserMembershipGroup[];
  displayName: string;
};

export function ProfileMembershipGroupsSection({
  groups,
  displayName,
}: ProfileMembershipGroupsSectionProps) {
  if (groups.length === 0) {
    return (
      <p className="hui-type-supporting">
        You are not in any groups yet. When someone invites you to a group, it will show up here.
      </p>
    );
  }

  return (
    <ul className="space-y-4">
      {groups.map((group) => (
        <li key={group.groupId} className="rounded-hui-lg bg-muted p-4">
          <Link
            href={`/groups/${group.groupId}`}
            className="hui-focus-ring text-base font-extrabold text-foreground"
          >
            {group.groupName}
          </Link>
          <p className="mt-1 text-sm font-semibold text-muted-foreground">
            You appear as {displayName}
          </p>
          <p className="mt-3 text-sm font-semibold text-muted-foreground">
            <Link href="/profile/dietary" className="hui-focus-ring font-bold text-foreground underline">
              Dietary sharing
            </Link>
            {" "}
            for this group is managed on your dietary settings page.
          </p>
        </li>
      ))}
    </ul>
  );
}
