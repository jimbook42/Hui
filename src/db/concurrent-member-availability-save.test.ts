import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

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

let db: PGlite;
let groupId: string;
let memberId: string;
let ownerId: string;

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

async function upsertYes(database: PGlite, userId: string, candidateId: string) {
  await asUser(database, userId);
  await database.query(
    `insert into public.event_responses (candidate_id, user_id, response, visibility)
     values ($1, $2, 'yes', 'group')
     on conflict (candidate_id, user_id) do update set response = excluded.response`,
    [candidateId, userId],
  );
}

describe("concurrent member availability save (HUI-0186)", () => {
  beforeAll(async () => {
    db = new PGlite();
    await db.exec(HARNESS_SQL);
    const dir = path.join(process.cwd(), "supabase", "migrations");
    const files = (await readdir(dir)).filter((file) => file.endsWith(".sql")).sort();
    for (const file of files) {
      await db.exec(await readFile(path.join(dir, file), "utf8"));
    }
    await db.query(`select set_config('hui.skip_auto_confirm', '1', false)`);

    ownerId = await createUser(db, "hui186-owner@hui.test", "Owner");
    memberId = await createUser(db, "hui186-member@hui.test", "Member");

    await asUser(db, ownerId);
    groupId = (
      await db.query<{ create_group: string }>(`select public.create_group($1) as create_group`, [
        "HUI-0186 trio",
      ])
    ).rows[0].create_group;
    await db.query(
      `insert into public.group_memberships (group_id, user_id, role, status)
       values ($1, $2, 'member', 'active')`,
      [groupId, memberId],
    );
  });

  afterAll(async () => {
    await db.close();
  });

  it("persists three concurrent upserts for one member across proposed candidates", async () => {
    await asUser(db, ownerId);
    const event = await db.query<{ id: string }>(
      `insert into public.events (group_id, title, status, created_by)
       values ($1, 'QA trio', 'proposing', $2) returning id`,
      [groupId, ownerId],
    );
    const eventId = event.rows[0].id;
    const starts = [
      "2031-11-04T23:00:00Z",
      "2031-11-06T23:00:00Z",
      "2031-11-11T23:00:00Z",
    ];
    const candidateIds: string[] = [];
    for (const startsAt of starts) {
      const row = await db.query<{ id: string }>(
        `insert into public.event_candidates (event_id, starts_at, ends_at, proposed_by)
         values ($1, $2, $3, $4) returning id`,
        [eventId, startsAt, null, ownerId],
      );
      candidateIds.push(row.rows[0].id);
    }

    await Promise.all(candidateIds.map((candidateId) => upsertYes(db, memberId, candidateId)));

    await asUser(db, memberId);
    const saved = await db.query<{ candidate_id: string }>(
      `select candidate_id from public.event_responses
       where user_id = $1 and candidate_id = any($2::uuid[])
       order by candidate_id`,
      [memberId, candidateIds],
    );
    expect(saved.rows.map((row) => row.candidate_id).sort()).toEqual(candidateIds.sort());
  });
});
