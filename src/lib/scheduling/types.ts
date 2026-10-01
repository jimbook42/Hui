import type { AvailabilityChoice, CandidateStatus } from "@/domain/scheduling/types";

export type EventCandidateRow = {
  id: string;
  startsAt: string;
  endsAt: string;
  status: CandidateStatus;
  proposedBy: string;
  createdAt: string;
  viewerResponse: AvailabilityChoice | null;
};

export type EventSchedulingContext = {
  candidates: EventCandidateRow[];
  maybeResponsesEnabled: boolean;
  minimumAttendees: number;
  consensusRule: "required_participants" | "minimum_attendees" | "all_active_members";
};
