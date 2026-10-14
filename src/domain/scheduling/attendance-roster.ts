export type RosterMember = {
  userId: string;
  displayName: string;
  response: "yes" | "no" | "maybe" | null;
  submittedLate?: boolean;
};

export type AttendanceRoster = {
  maybeResponsesEnabled: boolean;
  members: RosterMember[];
};

export type AttendanceGroup = {
  label: string;
  names: string[];
  /** Present when organisers need per-member late markers. */
  entries?: { displayName: string; submittedLate?: boolean }[];
};

function pushMember(
  bucket: string[],
  entries: { displayName: string; submittedLate?: boolean }[] | undefined,
  member: RosterMember,
  withLateEntries: boolean,
) {
  bucket.push(member.displayName);
  if (withLateEntries) {
    entries!.push({
      displayName: member.displayName,
      submittedLate: member.submittedLate === true,
    });
  }
}

export function groupAttendanceByResponse(
  roster: AttendanceRoster,
  options?: { showLateTags?: boolean },
): AttendanceGroup[] {
  const withLateEntries = options?.showLateTags === true;
  const canCome: string[] = [];
  const cantCome: string[] = [];
  const couldMakeItWork: string[] = [];
  const noResponse: string[] = [];
  const canComeEntries = withLateEntries ? [] : undefined;
  const cantComeEntries = withLateEntries ? [] : undefined;
  const couldMakeItWorkEntries = withLateEntries ? [] : undefined;
  const noResponseEntries = withLateEntries ? [] : undefined;

  for (const member of roster.members) {
    switch (member.response) {
      case "yes":
        pushMember(canCome, canComeEntries, member, withLateEntries);
        break;
      case "no":
        pushMember(cantCome, cantComeEntries, member, withLateEntries);
        break;
      case "maybe":
        if (roster.maybeResponsesEnabled) {
          pushMember(couldMakeItWork, couldMakeItWorkEntries, member, withLateEntries);
        } else {
          pushMember(noResponse, noResponseEntries, member, withLateEntries);
        }
        break;
      default:
        pushMember(noResponse, noResponseEntries, member, withLateEntries);
        break;
    }
  }

  const groups: AttendanceGroup[] = [];
  if (canCome.length > 0) {
    groups.push({
      label: "Can come",
      names: canCome,
      entries: canComeEntries,
    });
  }
  if (cantCome.length > 0) {
    groups.push({
      label: "Can't come",
      names: cantCome,
      entries: cantComeEntries,
    });
  }
  if (couldMakeItWork.length > 0) {
    groups.push({
      label: "Could make it work",
      names: couldMakeItWork,
      entries: couldMakeItWorkEntries,
    });
  }
  if (noResponse.length > 0) {
    groups.push({
      label: "Haven't responded",
      names: noResponse,
      entries: noResponseEntries,
    });
  }
  return groups;
}
