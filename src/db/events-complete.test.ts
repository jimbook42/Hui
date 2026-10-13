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
  admin: string;
  member: string;
  outsider: string;
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

async function insertConfirmedEvent(
  database: PGlite,
  actorId: string,
  groupId: string,
  title: string,
) {
  await asUser(database, actorId);
  const eventId = (
    await database.query<{ id: string }>(
      `insert into public.events (group_id, title, status, created_by)
       values ($1, $2, 'proposing', $3)
       returning id`,
      [groupId, title, actorId],
    )
  ).rows[0].id;

  await database.query(
    `update public.group_settings set minimum_attendees = 1 where group_id = $1`,
    [groupId],
  );

  const candidateId = (
    await database.query<{ id: string }>(
      `insert into public.event_candidates (
         event_id, group_id, starts_at, ends_at, proposed_by
       ) values (
         $1, $2, now() - interval '1 day', now() - interval '1 day' + interval '2 hours', $3
       ) returning id`,
      [eventId, groupId, actorId],
    )
  ).rows[0].id;

  await database.query(
    `insert into public.event_responses (
       candidate_id, event_id, group_id, user_id, response
     ) values ($1, $2, $3, $4, 'yes')`,
    [candidateId, eventId, groupId, actorId],
  );

  await database.query(`select public.finalise_event($1, $2)`, [eventId, candidateId]);
  return eventId;
}

describe("event complete (HUI-031-A)", () => {
  beforeAll(async () => {
    db = new PGlite();
    await db.exec(HARNESS_SQL);

    const dir = path.join(process.cwd(), "supabase", "migrations");
    const files = (await readdir(dir)).filter((file) => file.endsWith(".sql")).sort();
    for (const file of files) {
      await db.exec(await readFile(path.join(dir, file), "utf8"));
    }

    ids = {
      owner: await createUser(db, "cmp-owner@hui.test", "Olivia Owner"),
      admin: await createUser(db, "cmp-admin@hui.test", "Alex Admin"),
      member: await createUser(db, "cmp-member@hui.test", "Mia Member"),
      outsider: await createUser(db, "cmp-outsider@hui.test", "Omar Outsider"),
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

  it("lets creator and group admin complete via complete_event", async () => {
    const groupId = await createGroup(db, ids, "Complete RPC");
    const eventId = await insertConfirmedEvent(db, ids.member, groupId, "Past dinner");

    await asUser(db, ids.admin);
    await db.query(`select public.complete_event($1)`, [eventId]);

    const row = await db.query<{ status: string; completed_at: string | null }>(
      `select status, completed_at from public.events where id = $1`,
      [eventId],
    );
    expect(row.rows[0]?.status).toBe("completed");
    expect(row.rows[0]?.completed_at).toBeTruthy();
  });

  it("denies proposing status, participant, outsider, and repeat complete", async () => {
    const groupId = await createGroup(db, ids, "Complete deny");
    await asUser(db, ids.member);
    const proposing = await db.query<{ id: string }>(
      `insert into public.events (group_id, title, status, created_by)
       values ($1, 'Open', 'proposing', $2) returning id`,
      [groupId, ids.member],
    );

    await asUser(db, ids.member);
    const proposingErr = await expectFail(() =>
      db.query(`select public.complete_event($1)`, [proposing.rows[0].id]),
    );
    expect(proposingErr.toLowerCase()).toMatch(/confirmed/);

    const eventId = await insertConfirmedEvent(db, ids.admin, groupId, "Locked");

    await asUser(db, ids.member);
    const memberErr = await expectFail(() =>
      db.query(`select public.complete_event($1)`, [eventId]),
    );
    expect(memberErr.toLowerCase()).toMatch(/admin|creator/);

    await asUser(db, ids.admin);
    await db.query(`select public.complete_event($1)`, [eventId]);

    const againErr = await expectFail(() =>
      db.query(`select public.complete_event($1)`, [eventId]),
    );
    expect(againErr.toLowerCase()).toMatch(/already completed/);
  });
});
