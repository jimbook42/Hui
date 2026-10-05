import type { EventCoordinates } from "@/domain/events/location";
import type { EventFoodInvolvement } from "@/domain/events/food";
import type { CadenceUnit, EventStatus } from "@/domain/events/types";

export type EventListItem = {
  id: string;
  title: string;
  status: EventStatus;
  kind: "one_off" | "recurring";
  createdAt: string;
  creatorDisplayName: string;
};

export type RecurrenceSeriesSummary = {
  id: string;
  title: string;
  intervalUnit: CadenceUnit;
  intervalCount: number;
  startsOn: string;
  endsOn: string | null;
  archivedAt: string | null;
};

export type EventDetail = {
  id: string;
  groupId: string;
  groupName: string;
  title: string;
  status: EventStatus;
  kind: "one_off" | "recurring";
  location: string | null;
  /** Hui's own stored pin for the place (provider-independent); null when none was set. */
  locationCoordinates: EventCoordinates | null;
  /** Null on legacy events — dietary UI stays visible unless explicitly "no". */
  foodInvolvement: EventFoodInvolvement | null;
  hostPlaceRequired: boolean | null;
  notes: string | null;
  startsAt: string | null;
  endsAt: string | null;
  timezone: string | null;
  createdBy: string;
  creatorDisplayName: string;
  recurrenceSeries: RecurrenceSeriesSummary | null;
  createdAt: string;
  updatedAt: string;
  cancelledAt: string | null;
  viewerRole: "owner" | "admin" | "member";
};
