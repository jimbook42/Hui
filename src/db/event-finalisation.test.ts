import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { PGlite } from "@electric-sql/pglite";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { evaluateCandidateConsensus } from "@/domain/scheduling/consensus";

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
  admin: string;
  member: string;
  outsider: string;
};

type ConsensusPayload = {
  eligible_member_count: number;
  minimum_attendees: number;
  consensus_rule: string;
  maybe_responses_enabled: boolean;
  candidates: Array<{
    candidate_id: string;
    passes: boolean;
    accepted_count: number;
    maybe_count: number;
    unavailable_count: number;
    no_response_count: number;
    failure_reason: string | null;
    required_participant_count: number;
    required_accepted_count: number;
  }>;
};

let db: PGlite;
let ids: Ids;

function message(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "object" && error && "message" in error) {
    return String(error.message);
  }
  return String(error);
}

async function expectFail(run: () => Promise<unknown>): Promise<string> {
  try {
    await run();
  } catch (error) {
    return message(error);
  }
  throw new Error("expected the statement to fail");
}

async function asUser(database: PGlite, userId: string | null) {
  await database.exec("reset role");
  await database.query(`select set_config('request.jwt.claim.sub', $1, false)`, [
    userId ?? "",
  ]);
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

async function createGroup(database: PGlite, people: Ids, name: string) {
  await asUser(database, people.owner);
  const created = await database.query<{ id: string }>(
    `insert into public.groups (name, owner_id) values ($1, $2) returning id`,
    [name, people.owner],
  );
  const groupId = created.rows[0].id;
  await database.query(
    `insert into public.group_memberships (group_id, user_id, role)
     values ($1, $2, 'owner')`,
    [groupId, people.owner],
  );
  await database.query(
    `insert into public.group_memberships (group_id, user_id, role)
     values ($1, $2, 'admin')`,
    [groupId, people.admin],
  );
  await database.query(
    `insert into public.group_memberships (group_id, user_id, role)
     values ($1, $2, 'member')`,
    [groupId, people.member],
  );
  return groupId;
}

async function addCandidate(
  database: PGlite,
  eventId: string,
  proposerId: string,
  startsAt: string,
  endsAt: string,
) {
  const created = await database.query<{ id: string }>(
    `insert into public.event_candidates (event_id, starts_at, ends_at, proposed_by)
     values ($1, $2, $3, $4)
     returning id`,
    [eventId, startsAt, endsAt, proposerId],
  );
  return created.rows[0].id;
}

function parseSummary(value: unknown): ConsensusPayload {
  const parsed = typeof value === "string" ? JSON.parse(value) : value;
  return parsed as ConsensusPayload;
}

async function loadSummary(database: PGlite, userId: string, eventId: string) {
  await asUser(database, userId);
  const result = await database.query<{ event_consensus_summary: unknown }>(
    `select public.event_consensus_summary($1) as event_consensus_summary`,
    [eventId],
  );
  return parseSummary(result.rows[0].event_consensus_summary);
}

describe("event consensus finalisation (HUI-010)", () => {
  beforeAll(async () => {
    db = new PGlite();
    await db.exec(HARNESS_SQL);

    const dir = path.join(process.cwd(), "supabase", "migrations");
    const files = (await readdir(dir)).filter((file) => file.endsWith(".sql")).sort();
    for (const file of files) {
      await db.exec(await readFile(path.join(dir, file), "utf8"));
    }

    ids = {
      owner: await createUser(db, "owner-final@hui.test", "Olivia Owner"),
      admin: await createUser(db, "admin-final@hui.test", "Alex Admin"),
      member: await createUser(db, "member-final@hui.test", "Mia Member"),
      outsider: await createUser(db, "outsider-final@hui.test", "Owen Outsider"),
    };
  }, 60_000);

  afterEach(async () => {
    if (db) {
      await asUser(db, null);
    }
  });

  afterAll(async () => {
    await db?.close();
  });

  it("matches the domain evaluator and hides response identities", async () => {
    const groupId = await createGroup(db, ids, "Consensus match");
    await asUser(db, ids.owner);
    await db.query(
      `update public.group_settings
       set minimum_attendees = 2, consensus_rule = 'minimum_attendees'
       where group_id = $1`,
      [groupId],
    );
    const event = await db.query<{ id: string }>(
      `insert into public.events (group_id, title, status, created_by)
       values ($1, 'Dinner', 'proposing', $2)
       returning id`,
      [groupId, ids.owner],
    );
    const eventId = event.rows[0].id;
    const candidateId = await addCandidate(
      db,
      eventId,
      ids.owner,
      "2026-11-10T18:00:00Z",
      "2026-11-10T21:00:00Z",
    );

    await asUser(db, ids.owner);
    await db.query(
      `insert into public.event_responses (candidate_id, user_id, response, visibility)
       values ($1, $2, 'yes', 'private')`,
      [candidateId, ids.owner],
    );
    await asUser(db, ids.member);
    await db.query(
      `insert into public.event_responses (candidate_id, user_id, response, visibility)
       values ($1, $2, 'maybe', 'private')`,
      [candidateId, ids.member],
    );

    const summary = await loadSummary(db, ids.admin, eventId);
    const domain = evaluateCandidateConsensus({
      consensusRule: "minimum_attendees",
      minimumAttendees: 2,
      maybeResponsesEnabled: true,
      members: [
        { userId: ids.owner, consensusRequired: false },
        { userId: ids.admin, consensusRequired: false },
        { userId: ids.member, consensusRequired: false },
      ],
      responses: [
        { userId: ids.owner, response: "yes" },
        { userId: ids.member, response: "maybe" },
      ],
    });

    expect(summary.candidates).toHaveLength(1);
    expect(summary.candidates[0]).toMatchObject({
      candidate_id: candidateId,
      passes: domain.passes,
      accepted_count: domain.acceptedCount,
      maybe_count: domain.maybeCount,
      unavailable_count: domain.unavailableCount,
      no_response_count: domain.noResponseCount,
      failure_reason: domain.failureReason,
    });
    expect(domain.passes).toBe(true);

    const leaked = JSON.stringify(summary);
    expect(leaked).not.toContain(ids.owner);
    expect(leaked).not.toContain(ids.admin);
    expect(leaked).not.toContain(ids.member);

    await asUser(db, ids.admin);
    const privateRows = await db.query(
      `select response from public.event_responses where candidate_id = $1 and user_id = $2`,
      [candidateId, ids.member],
    );
    expect(privateRows.rows).toEqual([]);

    const denied = await expectFail(() =>
      db.query(`select public.candidate_consensus($1)`, [candidateId]),
    );
    expect(denied.toLowerCase()).toMatch(/permission denied|candidate_consensus/);
  });

  it("rejects finalisation that does not meet a consensus rule", async () => {
    const groupId = await createGroup(db, ids, "Rules");
    await asUser(db, ids.owner);
    await db.query(
      `update public.group_settings
       set minimum_attendees = 1,
           consensus_rule = 'all_active_members',
           maybe_responses_enabled = false
       where group_id = $1`,
      [groupId],
    );
    await db.query(
      `update public.group_memberships
       set consensus_required = true
       where group_id = $1 and user_id = $2`,
      [groupId, ids.member],
    );
    await asUser(db, ids.member);
    const event = await db.query<{ id: string }>(
      `insert into public.events (group_id, title, status, created_by)
       values ($1, 'Lunch', 'proposing', $2)
       returning id`,
      [groupId, ids.member],
    );
    const eventId = event.rows[0].id;
    const candidateId = await addCandidate(
      db,
      eventId,
      ids.member,
      "2026-11-12T12:00:00Z",
      "2026-11-12T14:00:00Z",
    );
    await asUser(db, ids.owner);
    await db.query(
      `insert into public.event_responses (candidate_id, user_id, response, visibility)
       values ($1, $2, 'yes', 'private')`,
      [candidateId, ids.owner],
    );
    await asUser(db, ids.admin);
    await db.query(
      `insert into public.event_responses (candidate_id, user_id, response, visibility)
       values ($1, $2, 'no', 'private')`,
      [candidateId, ids.admin],
    );

    const blocked = await loadSummary(db, ids.member, eventId);
    expect(blocked.candidates[0].failure_reason).toBe("all_active_members");
    expect(blocked.candidates[0].passes).toBe(false);

    await asUser(db, ids.member);
    const finaliseBlocked = await expectFail(() =>
      db.query(`select public.finalise_event($1, $2)`, [eventId, candidateId]),
    );
    expect(finaliseBlocked).toMatch(/does not meet the consensus requirements/);

    await asUser(db, ids.owner);
    await db.query(
      `update public.group_settings
       set consensus_rule = 'required_participants', minimum_attendees = 1
       where group_id = $1`,
      [groupId],
    );
    const missingRequired = await loadSummary(db, ids.owner, eventId);
    expect(missingRequired.candidates[0].failure_reason).toBe("required_participants");
    expect(missingRequired.candidates[0].required_participant_count).toBe(1);
    expect(missingRequired.candidates[0].required_accepted_count).toBe(0);

    await asUser(db, ids.owner);
    await db.query(
      `update public.group_settings
       set consensus_rule = 'minimum_attendees', minimum_attendees = 3
       where group_id = $1`,
      [groupId],
    );
    const belowMinimum = await loadSummary(db, ids.owner, eventId);
    expect(belowMinimum.candidates[0].accepted_count).toBe(1);
    expect(belowMinimum.candidates[0].failure_reason).toBe("below_minimum_attendees");
  });

  it("confirms the requested passing candidate and rejects everyone else", async () => {
    const groupId = await createGroup(db, ids, "Confirm");
    await asUser(db, ids.owner);
    await db.query(
      `update public.group_settings
       set minimum_attendees = 1, consensus_rule = 'minimum_attendees'
       where group_id = $1`,
      [groupId],
    );
    const event = await db.query<{ id: string }>(
      `insert into public.events (group_id, title, status, created_by)
       values ($1, 'Supper', 'proposing', $2)
       returning id`,
      [groupId, ids.owner],
    );
    const eventId = event.rows[0].id;
    const earlierId = await addCandidate(
      db,
      eventId,
      ids.owner,
      "2026-11-01T18:00:00Z",
      "2026-11-01T20:00:00Z",
    );
    const laterId = await addCandidate(
      db,
      eventId,
      ids.owner,
      "2026-11-20T18:00:00Z",
      "2026-11-20T20:00:00Z",
    );
    for (const candidateId of [earlierId, laterId]) {
      await asUser(db, ids.owner);
      await db.query(
        `insert into public.event_responses (candidate_id, user_id, response, visibility)
         values ($1, $2, 'yes', 'private')`,
        [candidateId, ids.owner],
      );
    }

    await asUser(db, ids.member);
    const unauthorised = await expectFail(() =>
      db.query(`select public.finalise_event($1, $2)`, [eventId, laterId]),
    );
    expect(unauthorised).toMatch(/cannot finalise/);

    await asUser(db, ids.outsider);
    const outsider = await expectFail(() =>
      db.query(`select public.event_consensus_summary($1)`, [eventId]),
    );
    expect(outsider).toMatch(/event not found/);

    await asUser(db, ids.owner);
    const wrongEvent = await db.query<{ id: string }>(
      `insert into public.events (group_id, title, status, created_by)
       values ($1, 'Other', 'proposing', $2)
       returning id`,
      [groupId, ids.owner],
    );
    const otherCandidate = await expectFail(() =>
      db.query(`select public.finalise_event($1, $2)`, [wrongEvent.rows[0].id, laterId]),
    );
    expect(otherCandidate).toMatch(/candidate not found/);

    await db.query(
      `update public.event_candidates set status = 'withdrawn' where id = $1`,
      [earlierId],
    );
    const withdrawn = await expectFail(() =>
      db.query(`select public.finalise_event($1, $2)`, [eventId, earlierId]),
    );
    expect(withdrawn).toMatch(/withdrawn/);
    await db.query(
      `update public.event_candidates set status = 'proposed' where id = $1`,
      [earlierId],
    );

    await db.query(
      `update public.events set status = 'cancelled', cancelled_at = now() where id = $1`,
      [eventId],
    );
    const cancelled = await expectFail(() =>
      db.query(`select public.finalise_event($1, $2)`, [eventId, laterId]),
    );
    expect(cancelled).toMatch(/cancelled/);
    await db.query(
      `update public.events
       set status = 'proposing', cancelled_at = null
       where id = $1`,
      [eventId],
    );

    const directConfirm = await expectFail(() =>
      db.query(
        `update public.events
         set status = 'confirmed', starts_at = '2026-11-20T18:00:00Z', ends_at = '2026-11-20T20:00:00Z'
         where id = $1`,
        [eventId],
      ),
    );
    expect(directConfirm).toMatch(/only by finalisation/);

    const insertConfirmed = await expectFail(() =>
      db.query(
        `insert into public.events (group_id, title, status, created_by, starts_at, ends_at)
         values ($1, 'Skip consensus', 'confirmed', $2, '2026-11-20T18:00:00Z', '2026-11-20T20:00:00Z')`,
        [groupId, ids.owner],
      ),
    );
    expect(insertConfirmed).toMatch(/only by finalisation/);

    const directSelect = await expectFail(() =>
      db.query(`update public.event_candidates set status = 'selected' where id = $1`, [
        laterId,
      ]),
    );
    expect(directSelect).toMatch(/only by finalisation/);

    await db.query(`select public.finalise_event($1, $2)`, [eventId, laterId]);

    const confirmed = await db.query<{
      status: string;
      starts_at: string;
      ends_at: string;
      confirmed_at: string | null;
    }>(
      `select status::text as status, starts_at::text as starts_at, ends_at::text as ends_at, confirmed_at::text as confirmed_at
       from public.events where id = $1`,
      [eventId],
    );
    expect(confirmed.rows[0].status).toBe("confirmed");
    expect(new Date(confirmed.rows[0].starts_at).toISOString()).toBe("2026-11-20T18:00:00.000Z");
    expect(new Date(confirmed.rows[0].ends_at).toISOString()).toBe("2026-11-20T20:00:00.000Z");
    expect(confirmed.rows[0].confirmed_at).toBeTruthy();

    const selected = await db.query<{ id: string; status: string }>(
      `select id, status::text as status
       from public.event_candidates
       where event_id = $1
       order by starts_at`,
      [eventId],
    );
    expect(selected.rows).toEqual([
      { id: earlierId, status: "proposed" },
      { id: laterId, status: "selected" },
    ]);

    const second = await expectFail(() =>
      db.query(`select public.finalise_event($1, $2)`, [eventId, earlierId]),
    );
    expect(second).toMatch(/already confirmed/);

    await asUser(db, ids.owner);
    const responseAfter = await expectFail(() =>
      db.query(
        `update public.event_responses
         set response = 'no'
         where candidate_id = $1 and user_id = $2`,
        [earlierId, ids.owner],
      ),
    );
    expect(responseAfter).toMatch(/no longer open for scheduling/);

    const candidateAfter = await expectFail(() =>
      addCandidate(db, eventId, ids.owner, "2026-12-01T18:00:00Z", "2026-12-01T20:00:00Z"),
    );
    expect(candidateAfter).toMatch(/no longer open for scheduling/);

    const withdrawAfter = await expectFail(() =>
      db.query(`update public.event_candidates set status = 'withdrawn' where id = $1`, [
        laterId,
      ]),
    );
    expect(withdrawAfter).toMatch(/no longer open for scheduling/);

    const timeAfter = await expectFail(() =>
      db.query(`update public.events set starts_at = '2026-11-01T18:00:00Z' where id = $1`, [
        eventId,
      ]),
    );
    expect(timeAfter).toMatch(/cannot be changed/);

    const statusAfter = await expectFail(() =>
      db.query(`update public.events set status = 'voting' where id = $1`, [eventId]),
    );
    expect(statusAfter).toMatch(/cannot change to that status/);

    await db.query(
      `update public.events
       set status = 'cancelled', cancelled_at = now()
       where id = $1`,
      [eventId],
    );
  });
});
