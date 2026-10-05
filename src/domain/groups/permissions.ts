export type MembershipRole = "owner" | "admin" | "member";

export function canManageMembers(role: MembershipRole): boolean {
  return role === "owner" || role === "admin";
}

export function canEditSettings(role: MembershipRole): boolean {
  return role === "owner" || role === "admin";
}

export function canTransferOwnership(role: MembershipRole): boolean {
  return role === "owner";
}

export function canRenameGroup(role: MembershipRole): boolean {
  return role === "owner" || role === "admin";
}

export function canDeleteGroup(role: MembershipRole): boolean {
  return role === "owner";
}
