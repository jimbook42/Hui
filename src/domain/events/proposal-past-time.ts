/** True when a wall-clock date (YYYY-MM-DD) is before today in the group time zone. */
export function isProposalDateBeforeToday(dateOnly: string, todayDateOnly: string): boolean {
  if (!dateOnly || !todayDateOnly) {
    return false;
  }
  return dateOnly < todayDateOnly;
}
