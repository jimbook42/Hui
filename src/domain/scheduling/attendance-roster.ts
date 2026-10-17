export type RosterMember = {
  userId: string;
  displayName: string;
  response: "yes" | "no" | "maybe" | null;
  submittedLate?: boolean;
  /** Present when the member chose can't come and shared a reason with the group. */
  declineReason?: string | null;
};

export type AttendanceRoster = {
  maybeResponsesEnabled: boolean;
  members: RosterMember[];
};

export type AttendanceGroup = {
  label: string;
  names: string[];
  /** Present when organisers need per-member late markers or shared decline reasons. */
  entries?: { displayName: string; submittedLate?: boolean; declineReason?: string | null }[];
};

function pushMember(
  bucket: string[],
  entries: { displayName: string; submittedLate?: boolean; declineReason?: string | null }[] | undefined,
  member: RosterMember,
  withEntries: boolean,
) {
  bucket.push(member.displayName);
  if (withEntries) {
    entries!.push({
      displayName: member.displayName,
      submittedLate: member.submittedLate === true,
      declineReason: member.declineReason?.trim() ? member.declineReason.trim() : null,
    });
  }
}

export function groupAttendanceByResponse(
  roster: AttendanceRoster,
  options?: { showLateTags?: boolean; showDeclineReasons?: boolean },
): AttendanceGroup[] {
  const withLateEntries = options?.showLateTags === true;
  const withDeclineReasons = options?.showDeclineReasons === true;
  const withEntries = withLateEntries || withDeclineReasons;
  const canCome: string[] = [];
  const cantCome: string[] = [];
  const couldMakeItWork: string[] = [];
  const noResponse: string[] = [];
  const canComeEntries = withEntries ? [] : undefined;
  const cantComeEntries = withEntries ? [] : undefined;
  const couldMakeItWorkEntries = withEntries ? [] : undefined;
  const noResponseEntries = withEntries ? [] : undefined;

  for (const member of roster.members) {
    switch (member.response) {
      case "yes":
        pushMember(canCome, canComeEntries, member, withEntries);
        break;
      case "no":
        pushMember(cantCome, cantComeEntries, member, withEntries);
        break;
      case "maybe":
        if (roster.maybeResponsesEnabled) {
          pushMember(couldMakeItWork, couldMakeItWorkEntries, member, withEntries);
        } else {
          pushMember(noResponse, noResponseEntries, member, withEntries);
        }
        break;
      default:
        pushMember(noResponse, noResponseEntries, member, withEntries);
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
