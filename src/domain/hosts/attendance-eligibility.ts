import type { AttendanceRoster } from "@/domain/scheduling/attendance-roster";

import type { HostEligibleMember } from "./rotation";

/** Members who may be suggested as host: attending (yes/maybe) and not hard-excluded. */
export function filterHostAssignableMembers(
  members: HostEligibleMember[],
  roster: AttendanceRoster | null,
  excludedUserIds: readonly string[] = [],
): HostEligibleMember[] {
  const excluded = new Set(excludedUserIds);
  const responseByUser = new Map(
    (roster?.members ?? []).map((member) => [member.userId, member.response]),
  );

  return members.filter((member) => {
    if (member.hostingStanding === "never" || excluded.has(member.userId)) {
      return false;
    }
    const response = responseByUser.get(member.userId);
    return response === "yes" || response === "maybe";
  });
}
