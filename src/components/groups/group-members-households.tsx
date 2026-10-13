import { avatarToneClass, initialsFor } from "@/components/hui/avatar-stack";
import type { GroupMembersHouseholdView } from "@/domain/households/group-display";
import type { GroupMemberRow } from "@/lib/groups/types";
import { cn } from "@/lib/ui/cn";

function roleLabel(role: string): string {
  if (role === "owner") return "Owner";
  if (role === "admin") return "Admin";
  return "Member";
}

type Person = { userId: string; displayName: string };

function MemberRows({
  people,
  roleByUserId,
  currentUserId,
}: {
  people: Person[];
  roleByUserId: Map<string, string>;
  currentUserId: string;
}) {
  return (
    <ul className="space-y-2">
      {people.map((member) => {
        const role = roleByUserId.get(member.userId) ?? "member";
        return (
          <li
            key={member.userId}
            className="flex min-h-14 items-center gap-3 rounded-hui-lg bg-muted px-3 py-2"
          >
            <span
              aria-hidden="true"
              className={cn(
                "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-extrabold text-foreground",
                avatarToneClass(member.userId),
              )}
            >
              {initialsFor(member.displayName)}
            </span>
            <p className="min-w-0 flex-1 truncate font-extrabold text-foreground">
              {member.displayName}
              {member.userId === currentUserId ? (
                <span className="font-semibold text-muted-foreground"> (you)</span>
              ) : null}
            </p>
            {role !== "member" ? (
              <span className="shrink-0 rounded-full bg-surface px-2.5 py-1 text-xs font-extrabold text-foreground">
                {roleLabel(role)}
              </span>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
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
  const roleByUserId = new Map<string, string>(members.map((member) => [member.userId, member.role]));

  return (
    <div className="space-y-6">
      {view.households.map((household) => (
        <div key={household.householdId}>
          <h3 className="hui-type-label mb-2 text-muted-foreground">{household.householdName}</h3>
          <MemberRows
            people={household.members}
            roleByUserId={roleByUserId}
            currentUserId={currentUserId}
          />
        </div>
      ))}

      {view.ungroupedMembers.length > 0 ? (
        <div>
          {view.households.length > 0 ? (
            <h3 className="hui-type-label mb-2 text-muted-foreground">No household</h3>
          ) : null}
          <MemberRows
            people={view.ungroupedMembers}
            roleByUserId={roleByUserId}
            currentUserId={currentUserId}
          />
        </div>
      ) : null}
    </div>
  );
}
