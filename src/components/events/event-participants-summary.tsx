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
    <section className="hui-card-section">
      <h2 className="hui-type-section text-foreground">
        Group members
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">
        {eligibleMemberCount} active {eligibleMemberCount === 1 ? "member" : "members"} can
        respond. Private notes stay private; attendance above shows who can come when responses are
        shared with the group.
      </p>

      <div className="mt-4 space-y-4 text-sm">
        {view.households.map((household) => (
          <div key={household.householdId}>
            <p className="font-medium text-foreground">
              {household.householdName}
            </p>
            <p className="mt-1 text-muted-foreground">
              {household.members.map((member) => member.displayName).join(", ")}
            </p>
          </div>
        ))}
        {view.ungroupedMembers.length > 0 ? (
          <div>
            <p className="font-medium text-foreground">No household</p>
            <p className="mt-1 text-muted-foreground">
              {view.ungroupedMembers.map((member) => member.displayName).join(", ")}
            </p>
          </div>
        ) : null}
        {listedCount === 0 ? (
          <p className="text-muted-foreground">No active members listed.</p>
        ) : null}
      </div>
    </section>
  );
}
