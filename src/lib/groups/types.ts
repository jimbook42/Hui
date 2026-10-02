import type { MembershipRole } from "@/domain/groups/permissions";

export type GroupListItem = {
  id: string;
  name: string;
  role: MembershipRole;
};

export type MemberHostingStanding = "default" | "prefer_not" | "never";

export type GroupMemberRow = {
  userId: string;
  displayName: string;
  role: MembershipRole;
  joinedAt: string;
  consensusRequired: boolean;
  hostingStanding: MemberHostingStanding;
};

export type GroupSettingsRow = {
  whoMayPropose: "admins_only" | "any_member";
  oneOffEventsAllowed: boolean;
  recurringEventsEnabled: boolean;
  maybeResponsesEnabled: boolean;
  minimumAttendees: number;
  proposalDeadlineHours: number | null;
  consensusRule: "required_participants" | "minimum_attendees" | "all_active_members";
  adminVetoEnabled: boolean;
  hostVetoEnabled: boolean;
  hostingEnabled: boolean;
  avoidConsecutiveHosts: boolean;
  timezone: string;
  reconnectRemindersEnabled: boolean;
  reconnectAfterDays: number | null;
};

export type GroupDetail = {
  id: string;
  name: string;
  ownerId: string;
  viewerRole: MembershipRole;
  members: GroupMemberRow[];
  settings: GroupSettingsRow;
};
