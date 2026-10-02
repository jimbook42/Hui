export type RosterMember = {
  userId: string;
  displayName: string;
  response: "yes" | "no" | "maybe" | null;
};

export type AttendanceRoster = {
  maybeResponsesEnabled: boolean;
  members: RosterMember[];
};

export type AttendanceGroup = {
  label: string;
  names: string[];
};

export function groupAttendanceByResponse(roster: AttendanceRoster): AttendanceGroup[] {
  const canCome: string[] = [];
  const cantCome: string[] = [];
  const couldMakeItWork: string[] = [];
  const noResponse: string[] = [];

  for (const member of roster.members) {
    switch (member.response) {
      case "yes":
        canCome.push(member.displayName);
        break;
      case "no":
        cantCome.push(member.displayName);
        break;
      case "maybe":
        if (roster.maybeResponsesEnabled) {
          couldMakeItWork.push(member.displayName);
        } else {
          noResponse.push(member.displayName);
        }
        break;
      default:
        noResponse.push(member.displayName);
        break;
    }
  }

  const groups: AttendanceGroup[] = [];
  if (canCome.length > 0) {
    groups.push({ label: "Can come", names: canCome });
  }
  if (cantCome.length > 0) {
    groups.push({ label: "Can't come", names: cantCome });
  }
  if (couldMakeItWork.length > 0) {
    groups.push({ label: "Could make it work", names: couldMakeItWork });
  }
  if (noResponse.length > 0) {
    groups.push({ label: "Haven't responded", names: noResponse });
  }
  return groups;
}
