export type HostAssignmentStatus = "proposed" | "accepted" | "declined" | "swapped_out";

export type HostAssignmentSnapshot = {
  id: string;
  eventId: string;
  userId: string;
  status: HostAssignmentStatus;
  displayName: string;
  createdAt: string;
};
