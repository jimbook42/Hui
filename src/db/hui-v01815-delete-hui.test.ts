import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { PGlite } from "@electric-sql/pglite";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { pinGroupToMinimumAttendeesConsensus } from "@/db/pin-group-consensus-for-tests";

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
select set_config('hui.allow_past_event_candidates', 'on', false);
`;

type Ids = { owner: string; member: string; admin: string };

let db: PGlite;
let ids: Ids;

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

async function createGroup(database: PGlite, ownerId: string) {
  await asUser(database, ownerId);
  const groupId = (
    await database.query<{ create_group: string }>(
      `select public.create_group('Delete decisions club') as create_group`,
    )
  ).rows[0].create_group;
  await pinGroupToMinimumAttendeesConsensus(database, groupId);
  return groupId;
}

async function insertProposingEvent(
  database: PGlite,
  actorId: string,
  groupId: string,
  title: string,
) {
  await asUser(database, actorId);
  const created = await database.query<{ id: string }>(
    `insert into public.events (group_id, title, status, created_by)
     values ($1, $2, 'proposing', $3)
     returning id`,
    [groupId, title, actorId],
  );
  return created.rows[0].id;
}

async function addMembers(database: PGlite, groupId: string) {
  await asUser(database, ids.owner);
  await database.query(
    `insert into public.group_memberships (group_id, user_id, role)
     values ($1, $2, 'member'), ($1, $3, 'admin')`,
    [groupId, ids.member, ids.admin],
  );
}

async function confirmEvent(database: PGlite, eventId: string, groupId: string, actorId: string) {
  await asUser(database, actorId);
  const candidateId = (
    await database.query<{ id: string }>(
      `insert into public.event_candidates (event_id, group_id, starts_at, ends_at, proposed_by)
       values ($1, $2, now() + interval '3 days', now() + interval '3 days' + interval '2 hours', $3)
       returning id`,
      [eventId, groupId, actorId],
    )
  ).rows[0].id;

  await database.query(
    `insert into public.event_responses (candidate_id, event_id, group_id, user_id, response, visibility)
     values ($1, $2, $3, $4, 'yes', 'private')`,
    [candidateId, eventId, groupId, actorId],
  );

  await database.query(`select public.finalise_event($1::uuid, $2::uuid)`, [eventId, candidateId]);
}

async function addDecidedPollWithVotes(
  database: PGlite,
  eventId: string,
  finalize: boolean,
) {
  await asUser(db, ids.owner);
  const decisionId = (
    await database.query<{ create_event_decision: string }>(
      `select public.create_event_decision($1, $2, $3) as create_event_decision`,
      [eventId, "Where?", ["Kitchen", "Park"]],
    )
  ).rows[0].create_event_decision;

  const options = await database.query<{ id: string }>(
    `select id from public.event_decision_options where decision_id = $1 order by position`,
    [decisionId],
  );

  await asUser(db, ids.member);
  await database.query(`select public.respond_event_decision($1, $2)`, [
    decisionId,
    options.rows[0].id,
  ]);

  if (finalize) {
    await asUser(db, ids.owner);
    await database.query(`select public.finalize_event_decision($1, $2)`, [
      decisionId,
      options.rows[0].id,
    ]);
  }

  return decisionId;
}

async function assertNoDecisionOrEventRows(eventId: string) {
  const event = await db.query(`select id from public.events where id = $1`, [eventId]);
  expect(event.rows).toEqual([]);

  const decisions = await db.query(
    `select id from public.event_decisions where event_id = $1`,
    [eventId],
  );
  expect(decisions.rows).toEqual([]);

  const options = await db.query(
    `select o.id
     from public.event_decision_options o
     inner join public.event_decisions d on d.id = o.decision_id
     where d.event_id = $1`,
    [eventId],
  );
  expect(options.rows).toEqual([]);

  const responses = await db.query(
    `select r.id
     from public.event_decision_responses r
     inner join public.event_decisions d on d.id = r.decision_id
     where d.event_id = $1`,
    [eventId],
  );
  expect(responses.rows).toEqual([]);
}

describe("v0.18.15 delete hui with event decisions", () => {
  beforeAll(async () => {
    db = new PGlite();
    await db.exec(HARNESS_SQL);

    const dir = path.join(process.cwd(), "supabase", "migrations");
    const files = (await readdir(dir)).filter((file) => file.endsWith(".sql")).sort();
    for (const file of files) {
      await db.exec(await readFile(path.join(dir, file), "utf8"));
    }
    await db.query(`select set_config('hui.skip_auto_confirm', '1', false)`);

    ids = {
      owner: await createUser(db, "v01815-owner@hui.test", "Owner"),
      member: await createUser(db, "v01815-member@hui.test", "Member"),
      admin: await createUser(db, "v01815-admin@hui.test", "Admin"),
    };
  }, 90_000);

  afterEach(async () => {
    if (db) {
      await asUser(db, null);
    }
  });

  afterAll(async () => {
    await db?.close();
  });

  it("deletes a confirmed hui with a decided poll and votes", async () => {
    const groupId = await createGroup(db, ids.owner);
    await addMembers(db, groupId);
    const eventId = await insertProposingEvent(db, ids.owner, groupId, "Confirmed dinner");
    await confirmEvent(db, eventId, groupId, ids.owner);
    await addDecidedPollWithVotes(db, eventId, true);

    await asUser(db, ids.owner);
    await db.query(`select public.delete_event($1)`, [eventId]);

    await assertNoDecisionOrEventRows(eventId);
  });

  it("deletes a proposing hui with an open poll and votes", async () => {
    const groupId = await createGroup(db, ids.owner);
    await addMembers(db, groupId);
    const eventId = await insertProposingEvent(db, ids.owner, groupId, "Proposing dinner");
    await addDecidedPollWithVotes(db, eventId, false);

    await asUser(db, ids.owner);
    await db.query(`select public.delete_event($1)`, [eventId]);

    await assertNoDecisionOrEventRows(eventId);
  });

  it("deletes an admin-picked confirmed hui with a decided poll", async () => {
    await db.query(`select set_config('hui.skip_auto_confirm', '1', false)`);
    const groupId = await createGroup(db, ids.owner);
    await addMembers(db, groupId);
    const eventId = await insertProposingEvent(db, ids.owner, groupId, "Admin pick dinner");
    await asUser(db, ids.owner);
    const candidateId = (
      await db.query<{ id: string }>(
        `insert into public.event_candidates (event_id, group_id, starts_at, proposed_by)
         values ($1, $2, now() + interval '4 days', $3)
         returning id`,
        [eventId, groupId, ids.owner],
      )
    ).rows[0].id;
    await asUser(db, ids.admin);
    await db.query(`select public.admin_finalise_event($1::uuid, $2::uuid)`, [eventId, candidateId]);
    await addDecidedPollWithVotes(db, eventId, true);

    await asUser(db, ids.owner);
    await db.query(`select public.delete_event($1)`, [eventId]);

    await assertNoDecisionOrEventRows(eventId);
  });

  it("deletes a cancelled hui with a cancelled poll", async () => {
    const groupId = await createGroup(db, ids.owner);
    await addMembers(db, groupId);
    const eventId = await insertProposingEvent(db, ids.owner, groupId, "Cancelled dinner");
    const decisionId = await addDecidedPollWithVotes(db, eventId, false);
    await asUser(db, ids.owner);
    await db.query(`select public.cancel_event_decision($1)`, [decisionId]);
    await db.query(
      `update public.events set status = 'cancelled', cancelled_at = now() where id = $1`,
      [eventId],
    );

    await asUser(db, ids.owner);
    await db.query(`select public.delete_event($1)`, [eventId]);

    await assertNoDecisionOrEventRows(eventId);
  });

  it("deletes a group that has an event with a decided poll", async () => {
    const groupId = await createGroup(db, ids.owner);
    await addMembers(db, groupId);
    const eventId = await insertProposingEvent(db, ids.owner, groupId, "Group delete hui");
    await confirmEvent(db, eventId, groupId, ids.owner);
    await addDecidedPollWithVotes(db, eventId, true);

    await asUser(db, ids.owner);
    await db.query(`select public.delete_group($1)`, [groupId]);

    const group = await db.query(`select id from public.groups where id = $1`, [groupId]);
    expect(group.rows).toEqual([]);
    await assertNoDecisionOrEventRows(eventId);
  });
});
