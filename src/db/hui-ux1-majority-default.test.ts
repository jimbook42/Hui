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
grant usage on schema auth to authenticated, service_role;
grant execute on function auth.uid() to authenticated, service_role;
`;

type Ids = { owner: string; m2: string; m3: string };

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

describe("majority default for new groups (HUI-UX1)", () => {
  beforeAll(async () => {
    db = new PGlite();
    await db.exec(HARNESS_SQL);
    const dir = path.join(process.cwd(), "supabase", "migrations");
    const files = (await readdir(dir)).filter((file) => file.endsWith(".sql")).sort();
    for (const file of files) {
      await db.exec(await readFile(path.join(dir, file), "utf8"));
    }
    ids = {
      owner: await createUser(db, "maj-owner@hui.test", "Owner"),
      m2: await createUser(db, "maj-m2@hui.test", "Member2"),
      m3: await createUser(db, "maj-m3@hui.test", "Member3"),
    };
  }, 90_000);

  afterEach(async () => {
    await asUser(db, null);
  });

  afterAll(async () => {
    await db?.close();
  });

  it("new groups default to majority_active_members", async () => {
    await asUser(db, ids.owner);
    const groupId = (
      await db.query<{ create_group: string }>(`select public.create_group($1) as create_group`, [
        "Majority default",
      ])
    ).rows[0].create_group;

    const rule = await db.query<{ consensus_rule: string }>(
      `select consensus_rule from public.group_settings where group_id = $1`,
      [groupId],
    );
    expect(rule.rows[0]?.consensus_rule).toBe("majority_active_members");
  });

  it("needs two of three yes votes to pass consensus under majority", async () => {
    await asUser(db, ids.owner);
    const groupId = (
      await db.query<{ create_group: string }>(`select public.create_group($1) as create_group`, [
        "Three member QA",
      ])
    ).rows[0].create_group;

    for (const memberId of [ids.m2, ids.m3]) {
      await db.query(
        `insert into public.group_memberships (group_id, user_id, role) values ($1, $2, 'member')`,
        [groupId, memberId],
      );
    }

    const eventId = (
      await db.query<{ id: string }>(
        `insert into public.events (group_id, title, status, created_by)
         values ($1, 'QA hui', 'proposing', $2) returning id`,
        [groupId, ids.owner],
      )
    ).rows[0].id;

    const candidateId = (
      await db.query<{ id: string }>(
        `insert into public.event_candidates (event_id, group_id, starts_at, status, proposed_by)
         values ($1, $2, now() + interval '7 days', 'proposed', $3) returning id`,
        [eventId, groupId, ids.owner],
      )
    ).rows[0].id;

    const respondYes = async (userId: string) => {
      await asUser(db, userId);
      await db.query(
        `insert into public.event_responses (event_id, candidate_id, user_id, response)
         values ($1, $2, $3, 'yes')`,
        [eventId, candidateId, userId],
      );
    };

    await respondYes(ids.owner);
    await asUser(db, null);
    const oneYes = await db.query<{ candidate_consensus: { passes: boolean } }>(
      `select public.candidate_consensus($1) as candidate_consensus`,
      [candidateId],
    );
    expect(oneYes.rows[0].candidate_consensus.passes).toBe(false);

    await respondYes(ids.m2);
    await asUser(db, null);
    const twoYes = await db.query<{ candidate_consensus: { passes: boolean } }>(
      `select public.candidate_consensus($1) as candidate_consensus`,
      [candidateId],
    );
    expect(twoYes.rows[0].candidate_consensus.passes).toBe(true);
  });
});
