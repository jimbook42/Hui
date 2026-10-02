import type { HostHistoryEntry } from "@/domain/hosts/rotation";
import type { HostAssignmentSnapshot } from "@/domain/hosts/types";

export type { HostHistoryEntry };

export type GroupHostHistory = {
  entries: HostHistoryEntry[];
  viewerCount: number | null;
};

export type EventHostContext = {
  assignments: HostAssignmentSnapshot[];
  history: GroupHostHistory;
};
