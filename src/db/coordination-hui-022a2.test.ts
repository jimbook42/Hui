import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { PGlite } from "@electric-sql/pglite";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

const HARNESS_SQL = `
create schema if not exists auth;

create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  raw_user_meta_data jsonb not null default '{}'::jsonb
);

create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin nobypassrls;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin nobypassrls;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin bypassrls;
  end if;
end
$$;

grant anon to current_user;
grant authenticated to current_user;
grant service_role to current_user;
grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
`;

type Ids = {
  owner: string;
  isaac: string;
  jamie: string;
  alice: string;
};

let db: PGlite;
let ids: Ids;
let groupId: string;

async function asUser(database: PGlite, userId: string | null) {
  await database.exec("reset role");
  await database.query(`select set_config('request.jwt.claim.sub', $1, false)`, [userId ?? ""]);
  if (userId) {
    await database.exec("set role authenticated");
  }
}

async function createUser(database: PGlite, email: string, displayName: string) {
  await asUser(database, null);
  const created = await database.query<{ id: string }>(
    `insert into auth.users (email, raw_user_meta_data)
     values ($1, jsonb_build_object('display_name', $2::text))
     returning id`,
    [email, displayName],
  );
  return created.rows[0].id;
}

async function insertSubsequentEvent(
  database: PGlite,
  title: string,
): Promise<{ eventId: string; candidateId: string }> {
  await asUser(database, ids.owner);
  const event = await database.query<{ id: string }>(
    `insert into public.events (group_id, title, status, created_by)
     values ($1, $2, 'proposing', $3) returning id`,
    [groupId, title, ids.owner],
  );
  const eventId = event.rows[0].id;
  const candidate = await database.query<{ id: string }>(
    `insert into public.event_candidates (event_id, starts_at, ends_at, proposed_by)
     values ($1, '2032-08-10T05:00:00Z', '2032-08-10T08:00:00Z', $2) returning id`,
    [eventId, ids.owner],
  );
  return { eventId, candidateId: candidate.rows[0].id };
}

async function respond(
  database: PGlite,
  userId: string,
  candidateId: string,
  response: "yes" | "no" | "maybe",
  note?: string,
) {
  await asUser(database, userId);
  await database.query(
    `insert into public.event_responses (candidate_id, user_id, response, visibility, note)
     values ($1, $2, $3, 'group', $4)
     on conflict (candidate_id, user_id) do update
       set response = excluded.response, note = excluded.note`,
    [candidateId, userId, response, note ?? null],
  );
}

describe("coordination HUI-022A.2", () => {
  beforeAll(async () => {
    db = new PGlite();
    await db.exec(HARNESS_SQL);
    const dir = path.join(process.cwd(), "supabase", "migrations");
    const files = (await readdir(dir)).filter((file) => file.endsWith(".sql")).sort();
    for (const file of files) {
      await db.exec(await readFile(path.join(dir, file), "utf8"));
    }

    ids = {
      owner: await createUser(db, "a2-owner@hui.test", "Olivia Owner"),
      isaac: await createUser(db, "a2-isaac@hui.test", "Isaac First"),
      jamie: await createUser(db, "a2-jamie@hui.test", "Jamie Later"),
      alice: await createUser(db, "a2-alice@hui.test", "Alice Away"),
    };

    await asUser(db, ids.owner);
    groupId = (
      await db.query<{ create_group: string }>(`select public.create_group($1) as create_group`, [
        "A2 group",
      ])
    ).rows[0].create_group;

    await db.query(
      `insert into public.group_memberships (group_id, user_id, role)
       values ($1, $2, 'member'), ($1, $3, 'member'), ($1, $4, 'member')`,
      [groupId, ids.isaac, ids.jamie, ids.alice],
    );
  }, 120_000);

  afterEach(async () => {
    await asUser(db, null);
  });

  afterAll(async () => {
    await db?.close();
  });

  async function assignmentCounts(eventId: string) {
    const rows = await db.query<{ status: string; n: string }>(
      `select status::text as status, count(*)::text as n
       from public.host_assignments where event_id = $1 group by status`,
      [eventId],
    );
    const counts = { proposed: 0, accepted: 0, total: 0 };
    for (const row of rows.rows) {
      const n = Number(row.n);
      counts.total += n;
      if (row.status === "proposed") counts.proposed = n;
      if (row.status === "accepted") counts.accepted = n;
    }
    return counts;
  }

  it("regression B: no host proposal before any attendance response", async () => {
    const { eventId } = await insertSubsequentEvent(db, "No early host");
    const event = await db.query<{ status: string }>(
      `select status::text as status from public.events where id = $1`,
      [eventId],
    );
    expect(event.rows[0].status).toBe("proposing");
    expect(await assignmentCounts(eventId)).toEqual({ proposed: 0, accepted: 0, total: 0 });
  });

  it("regression B: first attendance response can trigger host selection", async () => {
    const { eventId, candidateId } = await insertSubsequentEvent(db, "First response host");
    await respond(db, ids.jamie, candidateId, "yes");
    expect(await assignmentCounts(eventId)).toEqual({ proposed: 1, accepted: 0, total: 1 });
  });

  it("regression A: can't-come proposed host is cleared", async () => {
    const { eventId, candidateId } = await insertSubsequentEvent(db, "Alice decline");
    await respond(db, ids.alice, candidateId, "yes");
    const proposed = await db.query<{ user_id: string }>(
      `select user_id::text from public.host_assignments where event_id = $1 and status = 'proposed'`,
      [eventId],
    );
    expect(proposed.rows[0]?.user_id).toBe(ids.alice);

    await respond(db, ids.alice, candidateId, "no");
    expect(await assignmentCounts(eventId)).toEqual({ proposed: 0, accepted: 0, total: 1 });

    const stale = await db.query(
      `select 1 from public.host_assignments
       where event_id = $1 and user_id = $2 and status = 'proposed'`,
      [eventId, ids.alice],
    );
    expect(stale.rows).toHaveLength(0);
  });

  it("lifecycle: accept while proposing leaves exactly one accepted assignment", async () => {
    const { eventId, candidateId } = await insertSubsequentEvent(db, "Accept counts");
    await respond(db, ids.jamie, candidateId, "yes");
    await asUser(db, ids.jamie);
    await db.query(`select public.respond_to_host_assignment($1, true)`, [eventId]);
    expect(await assignmentCounts(eventId)).toEqual({ proposed: 0, accepted: 1, total: 1 });
    const event = await db.query<{ status: string }>(
      `select status::text as status from public.events where id = $1`,
      [eventId],
    );
    expect(event.rows[0].status).toBe("proposing");
  });

  it("regression C: proposed host can request swap and replacement accepts while proposing", async () => {
    const { eventId, candidateId } = await insertSubsequentEvent(db, "Swap pre-confirm");
    await respond(db, ids.isaac, candidateId, "yes");
    await respond(db, ids.jamie, candidateId, "yes");

    const firstProposed = await db.query<{ user_id: string }>(
      `select user_id::text from public.host_assignments
       where event_id = $1 and status = 'proposed' order by created_at desc limit 1`,
      [eventId],
    );
    const swapperId = firstProposed.rows[0].user_id;

    await asUser(db, swapperId);
    await db.query(`select public.request_host_swap($1)`, [eventId]);

    const swappedOut = await db.query(
      `select 1 from public.host_assignments
       where event_id = $1 and user_id = $2 and status = 'swapped_out'`,
      [eventId, swapperId],
    );
    expect(swappedOut.rows.length).toBeGreaterThan(0);

    const replacement = await db.query<{ user_id: string }>(
      `select user_id::text from public.host_assignments
       where event_id = $1 and status = 'proposed' order by created_at desc limit 1`,
      [eventId],
    );
    expect(replacement.rows[0]?.user_id).not.toBe(swapperId);

    await asUser(db, replacement.rows[0].user_id);
    await db.query(`select public.respond_to_host_assignment($1, true)`, [eventId]);
    expect(await assignmentCounts(eventId)).toEqual({ proposed: 0, accepted: 1, total: 2 });
    const event = await db.query<{ status: string }>(
      `select status::text as status from public.events where id = $1`,
      [eventId],
    );
    expect(event.rows[0].status).toBe("proposing");
  });

  it("regression C: proposed host can accept while still proposing", async () => {
    const { eventId, candidateId } = await insertSubsequentEvent(db, "Pre-confirm actions");
    await respond(db, ids.isaac, candidateId, "yes");
    await respond(db, ids.jamie, candidateId, "yes");

    const proposed = await db.query<{ user_id: string }>(
      `select user_id::text from public.host_assignments where event_id = $1 and status = 'proposed' order by created_at desc limit 1`,
      [eventId],
    );
    const proposedId = proposed.rows[0].user_id;

    await asUser(db, proposedId);
    await db.query(`select public.respond_to_host_assignment($1, true)`, [eventId]);
    const accepted = await db.query(
      `select 1 from public.host_assignments where event_id = $1 and status = 'accepted'`,
      [eventId],
    );
    expect(accepted.rows).toHaveLength(1);

    const status = await db.query<{ status: string }>(
      `select status::text as status from public.events where id = $1`,
      [eventId],
    );
    expect(status.rows[0].status).toBe("proposing");
  });

  it("keeps private attendance notes off roster and peer reads", async () => {
    const { candidateId } = await insertSubsequentEvent(db, "Private note");
    await respond(db, ids.alice, candidateId, "no", "Out of town");

    await asUser(db, ids.alice);
    const own = await db.query<{ note: string }>(
      `select note from public.event_responses where candidate_id = $1 and user_id = $2`,
      [candidateId, ids.alice],
    );
    expect(own.rows[0]?.note).toBe("Out of town");

    await asUser(db, ids.owner);
    const peer = await db.query(
      `select note from public.event_responses where candidate_id = $1 and user_id = $2`,
      [candidateId, ids.alice],
    );
    expect(peer.rows).toHaveLength(0);

    const roster = await db.query<{ candidate_attendance_roster: { members: { user_id: string; response: string }[] } }>(
      `select public.candidate_attendance_roster($1) as candidate_attendance_roster`,
      [candidateId],
    );
    const alice = roster.rows[0].candidate_attendance_roster.members.find(
      (m) => m.user_id === ids.alice,
    );
    expect(alice?.response).toBe("no");
    const payload = JSON.stringify(roster.rows[0].candidate_attendance_roster);
    expect(payload).not.toContain("Out of town");
  });

  it("regression D: consensus summary reports required_participants rule from settings", async () => {
    await asUser(db, ids.owner);
    await db.query(
      `update public.group_settings
       set consensus_rule = 'required_participants', minimum_attendees = 1
       where group_id = $1`,
      [groupId],
    );
    const { eventId } = await insertSubsequentEvent(db, "Consensus rule");
    const summary = await db.query<{ event_consensus_summary: { consensus_rule: string } }>(
      `select public.event_consensus_summary($1) as event_consensus_summary`,
      [eventId],
    );
    expect(summary.rows[0].event_consensus_summary.consensus_rule).toBe("required_participants");

    await db.query(
      `update public.group_settings set consensus_rule = 'minimum_attendees' where group_id = $1`,
      [groupId],
    );
  });

  it("consensus summary reports minimum_attendees rule from settings", async () => {
    await asUser(db, ids.owner);
    await db.query(
      `update public.group_settings
       set consensus_rule = 'minimum_attendees', minimum_attendees = 4
       where group_id = $1`,
      [groupId],
    );
    const { eventId } = await insertSubsequentEvent(db, "Minimum rule");
    const summary = await db.query<{
      event_consensus_summary: { consensus_rule: string; minimum_attendees: number };
    }>(`select public.event_consensus_summary($1) as event_consensus_summary`, [eventId]);
    expect(summary.rows[0].event_consensus_summary.consensus_rule).toBe("minimum_attendees");
    expect(summary.rows[0].event_consensus_summary.minimum_attendees).toBe(4);
    await db.query(
      `update public.group_settings set minimum_attendees = 1 where group_id = $1`,
      [groupId],
    );
  });

  it("does not treat first responder as locked-in when a better candidate appears", async () => {
    const prior = await insertSubsequentEvent(db, "Prior for fairness");
    await respond(db, ids.owner, prior.candidateId, "yes");
    await respond(db, ids.isaac, prior.candidateId, "yes");
    await respond(db, ids.jamie, prior.candidateId, "yes");
    await asUser(db, ids.owner);
    await db.query(`select public.finalise_event($1, $2)`, [prior.eventId, prior.candidateId]);
    const firstHost = await db.query<{ user_id: string }>(
      `select user_id::text from public.host_assignments where event_id = $1 and status = 'proposed'`,
      [prior.eventId],
    );
    await asUser(db, firstHost.rows[0].user_id);
    await db.query(`select public.respond_to_host_assignment($1, true)`, [prior.eventId]);

    const { eventId, candidateId } = await insertSubsequentEvent(db, "Reorder");
    await respond(db, ids.isaac, candidateId, "yes");
    let host = await db.query<{ user_id: string }>(
      `select user_id::text from public.host_assignments where event_id = $1 and status = 'proposed'`,
      [eventId],
    );
    expect(host.rows[0]?.user_id).toBe(ids.isaac);

    await respond(db, ids.jamie, candidateId, "yes");
    host = await db.query<{ user_id: string }>(
      `select user_id::text from public.host_assignments where event_id = $1 and status = 'proposed' order by created_at desc limit 1`,
      [eventId],
    );
    expect(host.rows[0]?.user_id).toBe(ids.jamie);
  });
});
