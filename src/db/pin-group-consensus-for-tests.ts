import type { PGlite } from "@electric-sql/pglite";

/** Legacy tests assume minimum_attendees consensus unless they opt into majority. */
export async function pinGroupToMinimumAttendeesConsensus(
  db: PGlite,
  groupId: string,
  minimumAttendees = 1,
): Promise<void> {
  await db.query(
    `update public.group_settings
     set consensus_rule = 'minimum_attendees', minimum_attendees = $2
     where group_id = $1`,
    [groupId, minimumAttendees],
  );
}
