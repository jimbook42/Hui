import type { AttendanceRoster } from "@/domain/scheduling/attendance-roster";
import { availabilityToDbResponse, dbResponseToAvailability } from "@/domain/scheduling/mapping";
import type { AvailabilityChoice } from "@/domain/scheduling/types";

/**
 * An optimistic attendance change (HUI-026P pattern): shown immediately while the server action
 * runs. `basedOn` is the server value at the time of the tap, so the override stops applying as
 * soon as fresh server data arrives — no manual clearing, and no stale override if someone else
 * changes the answer later.
 */
export type ViewerOverride = {
  choice: AvailabilityChoice;
  basedOn: AvailabilityChoice | null;
};

export function effectiveViewerResponse(
  serverResponse: AvailabilityChoice | null,
  override: ViewerOverride | null,
): AvailabilityChoice | null {
  if (override && override.basedOn === serverResponse) {
    return override.choice;
  }
  return serverResponse;
}

export function viewerResponseFromRoster(
  roster: AttendanceRoster,
  viewerUserId: string,
): AvailabilityChoice | null {
  const member = roster.members.find((entry) => entry.userId === viewerUserId);
  return member?.response ? dbResponseToAvailability(member.response) : null;
}

/** The roster as it will look once the viewer's pending change lands. Pure; never mutates. */
export function applyViewerOverrideToRoster(
  roster: AttendanceRoster,
  viewerUserId: string,
  override: ViewerOverride | null,
): AttendanceRoster {
  if (!override) {
    return roster;
  }
  const server = viewerResponseFromRoster(roster, viewerUserId);
  const effective = effectiveViewerResponse(server, override);
  if (effective === server) {
    return roster;
  }
  const next = effective ? availabilityToDbResponse(effective) : null;
  return {
    ...roster,
    members: roster.members.map((member) =>
      member.userId === viewerUserId ? { ...member, response: next } : member,
    ),
  };
}

export type ResponseChangeEffect =
  | "none"
  /** Moving to Yes: place and what to bring become relevant. */
  | "offer-details"
  /** Moving off Yes: anything the viewer was bringing is released. */
  | "release-contributions"
  | "update";

/**
 * What changing the answer means beyond the answer itself. Declining releases what the viewer
 * agreed to bring (enforced in the database; this only drives the confirmation copy).
 */
export function responseChangeEffect(
  from: AvailabilityChoice | null,
  to: AvailabilityChoice,
): ResponseChangeEffect {
  if (from === to) {
    return "none";
  }
  if (to === "available") {
    return "offer-details";
  }
  if (to === "unavailable") {
    return "release-contributions";
  }
  return "update";
}
