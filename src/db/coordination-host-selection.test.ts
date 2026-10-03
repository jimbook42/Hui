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
  sam: string;
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

async function insertProposingEventWithCandidate(
  database: PGlite,
  createdBy: string,
  title: string,
): Promise<{ eventId: string; candidateId: string }> {
  await asUser(database, createdBy);
  const event = await database.query<{ id: string }>(
    `insert into public.events (group_id, title, status, created_by)
     values ($1, $2, 'proposing', $3) returning id`,
    [groupId, title, createdBy],
  );
  const eventId = event.rows[0].id;
  const candidate = await database.query<{ id: string }>(
    `insert into public.event_candidates (event_id, starts_at, ends_at, proposed_by)
     values ($1, '2031-06-10T05:00:00Z', '2031-06-10T08:00:00Z', $2) returning id`,
    [eventId, createdBy],
  );
  return { eventId, candidateId: candidate.rows[0].id };
}

async function respondYes(database: PGlite, userId: string, candidateId: string) {
  await asUser(database, userId);
  await database.query(
    `insert into public.event_responses (candidate_id, user_id, response, visibility)
     values ($1, $2, 'yes', 'group')
     on conflict (candidate_id, user_id) do update set response = excluded.response`,
    [candidateId, userId],
  );
}

describe("coordination host selection (HUI-022A.1)", () => {
  beforeAll(async () => {
    db = new PGlite();
    await db.exec(HARNESS_SQL);
    const dir = path.join(process.cwd(), "supabase", "migrations");
    const files = (await readdir(dir)).filter((file) => file.endsWith(".sql")).sort();
    for (const file of files) {
      await db.exec(await readFile(path.join(dir, file), "utf8"));
    }

    ids = {
      owner: await createUser(db, "sel-owner@hui.test", "Olivia Owner"),
      isaac: await createUser(db, "sel-isaac@hui.test", "Isaac First"),
      jamie: await createUser(db, "sel-jamie@hui.test", "Jamie Later"),
      sam: await createUser(db, "sel-sam@hui.test", "Sam Never"),
    };

    await asUser(db, ids.owner);
    groupId = (
      await db.query<{ create_group: string }>(`select public.create_group($1) as create_group`, [
        "Selection group",
      ])
    ).rows[0].create_group;

    await db.query(
      `insert into public.group_memberships (group_id, user_id, role)
       values ($1, $2, 'member'), ($1, $3, 'member'), ($1, $4, 'member')`,
      [groupId, ids.isaac, ids.jamie, ids.sam],
    );
    await asUser(db, ids.sam);
    await db.query(`select public.set_my_hosting_standing($1, 'never')`, [groupId]);
  }, 90_000);

  afterEach(async () => {
    await asUser(db, null);
  });

  afterAll(async () => {
    await db?.close();
  });

  it("reconsiders a pending auto proposal when a better candidate becomes eligible", async () => {
    await asUser(db, ids.owner);
    const prior = await insertProposingEventWithCandidate(db, ids.owner, "Prior host");
    await respondYes(db, ids.owner, prior.candidateId);
    await respondYes(db, ids.isaac, prior.candidateId);
    await asUser(db, ids.owner);
    await db.query(`select public.finalise_event($1, $2)`, [prior.eventId, prior.candidateId]);
    const priorHost = await db.query<{ user_id: string }>(
      `select user_id::text from public.host_assignments where event_id = $1 and status = 'proposed'`,
      [prior.eventId],
    );
    await asUser(db, priorHost.rows[0].user_id);
    await db.query(`select public.respond_to_host_assignment($1, true)`, [prior.eventId]);

    const { eventId, candidateId } = await insertProposingEventWithCandidate(
      db,
      ids.owner,
      "Reorder host",
    );
    await respondYes(db, ids.isaac, candidateId);

    let host = await db.query<{ user_id: string }>(
      `select user_id::text from public.host_assignments where event_id = $1 and status = 'proposed'`,
      [eventId],
    );
    expect(host.rows[0]?.user_id).toBe(ids.isaac);

    await respondYes(db, ids.jamie, candidateId);

    host = await db.query<{ user_id: string }>(
      `select user_id::text from public.host_assignments where event_id = $1 and status = 'proposed' order by created_at desc limit 1`,
      [eventId],
    );
    expect(host.rows[0]?.user_id).toBe(ids.jamie);
  });

  it("keeps an accepted host when a later member responds", async () => {
    await asUser(db, ids.owner);
    const { eventId, candidateId } = await insertProposingEventWithCandidate(
      db,
      ids.owner,
      "Stable host",
    );
    await respondYes(db, ids.jamie, candidateId);
    await asUser(db, ids.jamie);
    await db.query(`select public.respond_to_host_assignment($1, true)`, [eventId]);

    await respondYes(db, ids.isaac, candidateId);

    const accepted = await db.query<{ user_id: string }>(
      `select user_id::text from public.host_assignments where event_id = $1 and status = 'accepted'`,
      [eventId],
    );
    expect(accepted.rows[0]?.user_id).toBe(ids.jamie);
    const proposed = await db.query(
      `select 1 from public.host_assignments where event_id = $1 and status = 'proposed'`,
      [eventId],
    );
    expect(proposed.rows).toHaveLength(0);
  });

  it("excludes never-host and unavailable members from automatic selection", async () => {
    await asUser(db, ids.owner);
    const { eventId, candidateId } = await insertProposingEventWithCandidate(
      db,
      ids.owner,
      "Eligibility",
    );
    await respondYes(db, ids.owner, candidateId);
    await asUser(db, ids.sam);
    await db.query(
      `insert into public.event_responses (candidate_id, user_id, response, visibility)
       values ($1, $2, 'yes', 'group')`,
      [candidateId, ids.sam],
    );

    const host = await db.query<{ user_id: string }>(
      `select user_id::text from public.host_assignments where event_id = $1 and status = 'proposed'`,
      [eventId],
    );
    expect(host.rows[0]?.user_id).not.toBe(ids.sam);
  });

  it("respects avoid_consecutive_hosts when another candidate exists", async () => {
    await asUser(db, ids.owner);
    await db.query(`update public.group_settings set avoid_consecutive_hosts = true where group_id = $1`, [
      groupId,
    ]);

    const first = await insertProposingEventWithCandidate(db, ids.owner, "Consecutive A");
    await respondYes(db, ids.owner, first.candidateId);
    await respondYes(db, ids.isaac, first.candidateId);
    await respondYes(db, ids.jamie, first.candidateId);
    await asUser(db, ids.owner);
    await db.query(`select public.finalise_event($1, $2)`, [first.eventId, first.candidateId]);
    const firstHost = await db.query<{ user_id: string }>(
      `select user_id::text from public.host_assignments where event_id = $1 and status = 'proposed'`,
      [first.eventId],
    );
    const lastAcceptedHostId = firstHost.rows[0].user_id;
    await asUser(db, lastAcceptedHostId);
    await db.query(`select public.respond_to_host_assignment($1, true)`, [first.eventId]);

    const second = await insertProposingEventWithCandidate(db, ids.owner, "Consecutive B");
    await respondYes(db, ids.owner, second.candidateId);
    await respondYes(db, ids.isaac, second.candidateId);
    await respondYes(db, ids.jamie, second.candidateId);

    const host = await db.query<{ user_id: string }>(
      `select user_id::text from public.host_assignments where event_id = $1 and status = 'proposed'`,
      [second.eventId],
    );
    expect(host.rows[0]?.user_id).not.toBe(lastAcceptedHostId);
    expect([ids.isaac, ids.jamie, ids.owner]).toContain(host.rows[0]?.user_id);

    await db.query(`update public.group_settings set avoid_consecutive_hosts = false where group_id = $1`, [
      groupId,
    ]);
  });
});
