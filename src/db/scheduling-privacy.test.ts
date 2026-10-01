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
};

let db: PGlite;
let ids: Ids;

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

describe("scheduling privacy (HUI-009)", () => {
  beforeAll(async () => {
    db = new PGlite();
    await db.exec(HARNESS_SQL);

    const dir = path.join(process.cwd(), "supabase", "migrations");
    const files = (await readdir(dir)).filter((file) => file.endsWith(".sql")).sort();
    for (const file of files) {
      await db.exec(await readFile(path.join(dir, file), "utf8"));
    }

    ids = {
      owner: await createUser(db, "owner-privacy@hui.test", "Olivia Owner"),
      admin: await createUser(db, "admin-privacy@hui.test", "Alex Admin"),
      member: await createUser(db, "member-privacy@hui.test", "Mia Member"),
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

  it("hides another member's private availability from peers and admins", async () => {
    const groupId = await createGroup(db, ids, "Availability privacy");
    await asUser(db, ids.owner);
    const event = await db.query<{ id: string }>(
      `insert into public.events (group_id, title, created_by)
       values ($1, 'Dinner', $2)
       returning id`,
      [groupId, ids.owner],
    );
    const candidate = await db.query<{ id: string }>(
      `insert into public.event_candidates (event_id, starts_at, ends_at, proposed_by)
       values ($1, '2026-11-10T18:00:00Z', '2026-11-10T21:00:00Z', $2)
       returning id`,
      [event.rows[0].id, ids.owner],
    );
    const candidateId = candidate.rows[0].id;

    await asUser(db, ids.member);
    await db.query(
      `insert into public.event_responses (candidate_id, user_id, response, visibility)
       values ($1, $2, 'no', 'private')`,
      [candidateId, ids.member],
    );

    await asUser(db, ids.owner);
    const ownerSeesMember = await db.query<{ response: string }>(
      `select response::text as response
       from public.event_responses
       where candidate_id = $1 and user_id = $2`,
      [candidateId, ids.member],
    );

    await asUser(db, ids.admin);
    const adminSeesMember = await db.query<{ response: string }>(
      `select response::text as response
       from public.event_responses
       where candidate_id = $1 and user_id = $2`,
      [candidateId, ids.member],
    );

    await asUser(db, ids.member);
    const memberSeesOwn = await db.query<{ response: string }>(
      `select response::text as response
       from public.event_responses
       where candidate_id = $1 and user_id = $2`,
      [candidateId, ids.member],
    );

    expect(ownerSeesMember.rows).toEqual([]);
    expect(adminSeesMember.rows).toEqual([]);
    expect(memberSeesOwn.rows.map((row) => row.response)).toEqual(["no"]);
  });

  it("rejects maybe responses when the group disables them", async () => {
    const groupId = await createGroup(db, ids, "No maybe");
    await asUser(db, ids.owner);
    await db.query(
      `update public.group_settings set maybe_responses_enabled = false where group_id = $1`,
      [groupId],
    );
    const event = await db.query<{ id: string }>(
      `insert into public.events (group_id, title, created_by)
       values ($1, 'Lunch', $2)
       returning id`,
      [groupId, ids.owner],
    );
    const candidate = await db.query<{ id: string }>(
      `insert into public.event_candidates (event_id, starts_at, ends_at, proposed_by)
       values ($1, '2026-11-11T12:00:00Z', '2026-11-11T14:00:00Z', $2)
       returning id`,
      [event.rows[0].id, ids.owner],
    );

    await asUser(db, ids.member);
    let failed = false;
    try {
      await db.query(
        `insert into public.event_responses (candidate_id, user_id, response, visibility)
         values ($1, $2, 'maybe', 'private')`,
        [candidate.rows[0].id, ids.member],
      );
    } catch {
      failed = true;
    }
    expect(failed).toBe(true);
  });
});
