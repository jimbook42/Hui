/** Plain-language line for why a hui confirmed (yes votes vs active members). */
export function formatConfirmedBecauseLine(input: {
  yesCount: number;
  eligibleMemberCount: number;
}): string {
  const { yesCount, eligibleMemberCount } = input;
  if (eligibleMemberCount <= 0) {
    return `Confirmed: ${yesCount} said yes`;
  }
  return `Confirmed: ${yesCount} of ${eligibleMemberCount} said yes`;
}
