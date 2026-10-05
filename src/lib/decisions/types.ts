export type EventDecisionStatus = "open" | "decided" | "cancelled";

export type EventDecisionRow = {
  id: string;
  eventId: string;
  groupId: string;
  question: string;
  status: EventDecisionStatus;
  createdBy: string;
  selectedOptionId: string | null;
  decidedBy: string | null;
  decidedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
};

export type EventDecisionOptionRow = {
  id: string;
  decisionId: string;
  label: string;
  position: number;
};

export type EventDecisionResponseRow = {
  id: string;
  decisionId: string;
  optionId: string;
  userId: string;
};

export type EventDecisionBundle = {
  decision: EventDecisionRow;
  options: EventDecisionOptionRow[];
  responses: EventDecisionResponseRow[];
};
