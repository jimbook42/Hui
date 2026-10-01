export const EVENT_STATUSES = [
  "draft",
  "proposing",
  "voting",
  "awaiting_agreement",
  "confirmed",
  "reopened",
  "completed",
  "cancelled",
] as const;

export type EventStatus = (typeof EVENT_STATUSES)[number];

export const TERMINAL_EVENT_STATUSES: readonly EventStatus[] = [
  "completed",
  "cancelled",
];

export type CadenceUnit = "week" | "month";

export type EventKind = "one_off" | "recurring";
