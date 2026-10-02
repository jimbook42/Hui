import type { GroupMembersHouseholdView } from "@/domain/households/group-display";
import type { GroupMemberRow } from "@/lib/groups/types";

function roleLabel(role: string): string {
  if (role === "owner") return "Owner";
  if (role === "admin") return "Admin";
  return "Member";
}

export function GroupMembersHouseholds({
  view,
  members,
  currentUserId,
}: {
  view: GroupMembersHouseholdView;
  members: GroupMemberRow[];
  currentUserId: string;
}) {
  const roleByUserId = new Map(members.map((member) => [member.userId, member.role]));

  return (
    <div className="space-y-6">
      {view.households.map((household) => (
        <div key={household.householdId}>
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
            {household.householdName}
          </h3>
          <ul className="mt-2 divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
            {household.members.map((member) => (
              <li key={member.userId} className="px-4 py-3 text-sm">
                <p className="font-medium text-zinc-900 dark:text-zinc-50">
                  {member.displayName}
                  {member.userId === currentUserId ? " (you)" : ""}
                </p>
                <p className="text-xs text-zinc-500">
                  {roleLabel(roleByUserId.get(member.userId) ?? "member")}
                </p>
              </li>
            ))}
          </ul>
        </div>
      ))}

      {view.ungroupedMembers.length > 0 ? (
        <div>
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
            No household
          </h3>
          <ul className="mt-2 divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
            {view.ungroupedMembers.map((member) => (
              <li key={member.userId} className="px-4 py-3 text-sm">
                <p className="font-medium text-zinc-900 dark:text-zinc-50">
                  {member.displayName}
                  {member.userId === currentUserId ? " (you)" : ""}
                </p>
                <p className="text-xs text-zinc-500">
                  {roleLabel(roleByUserId.get(member.userId) ?? "member")}
                </p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
