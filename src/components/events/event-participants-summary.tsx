import type { GroupMembersHouseholdView } from "@/domain/households/group-display";

type EventParticipantsSummaryProps = {
  view: GroupMembersHouseholdView;
  eligibleMemberCount: number;
};

/** Group roster for context; consensus stays member-based and aggregate-only elsewhere. */
export function EventParticipantsSummary({
  view,
  eligibleMemberCount,
}: EventParticipantsSummaryProps) {
  const householdMemberCount = view.households.reduce(
    (sum, household) => sum + household.members.length,
    0,
  );
  const listedCount = householdMemberCount + view.ungroupedMembers.length;

  return (
    <section className="mt-10 border-t border-zinc-200 pt-10 dark:border-zinc-800">
      <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
        Group members
      </h2>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        {eligibleMemberCount} active {eligibleMemberCount === 1 ? "member" : "members"}{" "}
        can respond privately. Attendance totals above never name individuals.
      </p>

      <div className="mt-4 space-y-4 text-sm">
        {view.households.map((household) => (
          <div key={household.householdId}>
            <p className="font-medium text-zinc-800 dark:text-zinc-200">
              {household.householdName}
            </p>
            <p className="mt-1 text-zinc-600 dark:text-zinc-400">
              {household.members.map((member) => member.displayName).join(", ")}
            </p>
          </div>
        ))}
        {view.ungroupedMembers.length > 0 ? (
          <div>
            <p className="font-medium text-zinc-800 dark:text-zinc-200">No household</p>
            <p className="mt-1 text-zinc-600 dark:text-zinc-400">
              {view.ungroupedMembers.map((member) => member.displayName).join(", ")}
            </p>
          </div>
        ) : null}
        {listedCount === 0 ? (
          <p className="text-zinc-500">No active members listed.</p>
        ) : null}
      </div>
    </section>
  );
}
