import { StandingAvailabilityEditor } from "@/components/profile/standing-availability-editor";
import type { StandingAvailabilityWindow } from "@/domain/scheduling/standing-availability";

export type GroupStandingAvailabilityContext = {
  groupId: string;
  groupName: string;
  timeZone: string;
  windows: StandingAvailabilityWindow[];
};

export function StandingAvailabilitySection({
  groups,
}: {
  groups: GroupStandingAvailabilityContext[];
}) {
  if (groups.length === 0) {
    return (
      <p className="hui-type-supporting">
        Join a group to save your usual availability for that group.
      </p>
    );
  }

  return (
    <ul className="space-y-8">
      {groups.map((group) => (
        <li key={group.groupId} className="rounded-hui-lg bg-muted p-4">
          <h3 className="hui-type-section text-foreground">{group.groupName}</h3>
          <div className="mt-3">
            <StandingAvailabilityEditor
              groupId={group.groupId}
              groupName={group.groupName}
              timeZone={group.timeZone}
              windows={group.windows}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
