export type ManageSectionId =
  | "hui"
  | "people"
  | "time"
  | "host"
  | "place"
  | "contributions"
  | "decisions"
  | "dietary";

export function defaultOpenManageSection(input: {
  canFinalise: boolean;
  anyCandidatePasses: boolean;
  coordinateContributions: boolean;
  unclaimedContributionCount: number;
  canAssignHost: boolean;
  hasAcceptedHost: boolean;
}): ManageSectionId {
  if (input.canFinalise && input.anyCandidatePasses) {
    return "time";
  }
  if (input.coordinateContributions && input.unclaimedContributionCount > 0) {
    return "contributions";
  }
  if (input.canAssignHost && !input.hasAcceptedHost) {
    return "host";
  }
  return "hui";
}
