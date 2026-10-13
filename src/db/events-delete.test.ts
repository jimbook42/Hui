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

async function insertEvent(
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

describe("event delete (HUI-026D)", () => {
  beforeAll(async () => {
    db = new PGlite();
    await db.exec(HARNESS_SQL);

    const dir = path.join(process.cwd(), "supabase", "migrations");
    const files = (await readdir(dir)).filter((file) => file.endsWith(".sql")).sort();
    for (const file of files) {
      await db.exec(await readFile(path.join(dir, file), "utf8"));
    }

    ids = {
      owner: await createUser(db, "del-owner@hui.test", "Olivia Owner"),
      admin: await createUser(db, "del-admin@hui.test", "Alex Admin"),
      member: await createUser(db, "del-member@hui.test", "Mia Member"),
      outsider: await createUser(db, "del-outsider@hui.test", "Omar Outsider"),
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

  it("lets creator and group admin delete via delete_event", async () => {
    const groupId = await createGroup(db, ids, "Delete RPC");
    const eventId = await insertEvent(db, ids.member, groupId, "To remove");

    await asUser(db, ids.admin);
    await db.query(`select public.delete_event($1)`, [eventId]);

    const gone = await db.query(`select id from public.events where id = $1`, [eventId]);
    expect(gone.rows).toEqual([]);

    const groupStill = await db.query(`select id from public.groups where id = $1`, [groupId]);
    expect(groupStill.rows).toHaveLength(1);
  });

  it("denies participant, outsider, and unauthenticated delete", async () => {
    const groupId = await createGroup(db, ids, "Delete deny");
    const eventId = await insertEvent(db, ids.admin, groupId, "Protected");

    await asUser(db, ids.member);
    const otherEventId = await insertEvent(db, ids.member, groupId, "Sibling");

    await asUser(db, ids.member);
    const memberErr = await expectFail(() =>
      db.query(`select public.delete_event($1)`, [eventId]),
    );
    expect(memberErr.toLowerCase()).toMatch(/admin|creator|delete/);

    await asUser(db, ids.outsider);
    const outsiderErr = await expectFail(() =>
      db.query(`select public.delete_event($1)`, [eventId]),
    );
    expect(outsiderErr.toLowerCase()).toMatch(/member|not/);

    await asUser(db, null);
    const anonErr = await expectFail(() =>
      db.query(`select public.delete_event($1)`, [eventId]),
    );
    expect(anonErr.toLowerCase()).toMatch(/authenticated/);

    const sibling = await db.query(`select id from public.events where id = $1`, [otherEventId]);
    expect(sibling.rows).toHaveLength(1);
  });

  it("removes dependent planning rows", async () => {
    const groupId = await createGroup(db, ids, "Delete cascade");
    const eventId = await insertEvent(db, ids.member, groupId, "With deps");

    await asUser(db, ids.member);
    const candidate = await db.query<{ id: string }>(
      `insert into public.event_candidates (
         event_id, group_id, starts_at, ends_at, proposed_by
       ) values (
         $1, $2, now() + interval '1 day', now() + interval '1 day' + interval '2 hours', $3
       ) returning id`,
      [eventId, groupId, ids.member],
    );

    await db.query(
      `insert into public.event_responses (
         candidate_id, event_id, group_id, user_id, response
       ) values ($1, $2, $3, $4, 'yes')`,
      [candidate.rows[0].id, eventId, groupId, ids.member],
    );

    await db.query(`select public.delete_event($1)`, [eventId]);

    const candidates = await db.query(
      `select id from public.event_candidates where event_id = $1`,
      [eventId],
    );
    expect(candidates.rows).toEqual([]);

    const responses = await db.query(
      `select id from public.event_responses where event_id = $1`,
      [eventId],
    );
    expect(responses.rows).toEqual([]);
  });
});
