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
  member: string;
};

let db: PGlite;
let ids: Ids;
let groupId: string;
let eventId: string;
let dessertId: string;
let mainId: string;

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

describe("contributions HUI-026E", () => {
  beforeAll(async () => {
    db = new PGlite();
    await db.exec(HARNESS_SQL);

    const dir = path.join(process.cwd(), "supabase", "migrations");
    const files = (await readdir(dir)).filter((file) => file.endsWith(".sql")).sort();
    for (const file of files) {
      await db.exec(await readFile(path.join(dir, file), "utf8"));
    }

    ids = {
      owner: await createUser(db, "026e-owner@hui.test", "Olivia Owner"),
      member: await createUser(db, "026e-member@hui.test", "Mia Member"),
    };

    await asUser(db, ids.owner);
    groupId = (
      await db.query<{ create_group: string }>(`select public.create_group($1) as create_group`, [
        "026E group",
      ])
    ).rows[0].create_group;

    await db.query(
      `insert into public.group_memberships (group_id, user_id, role) values ($1, $2, 'member')`,
      [groupId, ids.member],
    );

    dessertId = (
      await db.query<{ id: string }>(
        `insert into public.contribution_categories (group_id, name) values ($1, 'Dessert') returning id`,
        [groupId],
      )
    ).rows[0].id;

    mainId = (
      await db.query<{ id: string }>(
        `insert into public.contribution_categories (group_id, name, follows_host) values ($1, 'Main', true) returning id`,
        [groupId],
      )
    ).rows[0].id;

    eventId = (
      await db.query<{ id: string }>(
        `insert into public.events (group_id, title, status, created_by)
         values ($1, 'Potluck', 'proposing', $2) returning id`,
        [groupId, ids.owner],
      )
    ).rows[0].id;

    await db.query(
      `insert into public.event_contributions (event_id, group_id, category_id, user_id, label, status, assigned_by)
       values ($1, $2, $3, null, 'Dessert', 'open', $4)`,
      [eventId, groupId, dessertId, ids.owner],
    );
  }, 60_000);

  afterEach(async () => {
    if (db) {
      await asUser(db, null);
    }
  });

  afterAll(async () => {
    await db?.close();
  });

  it("claims an existing open row instead of duplicating", async () => {
    await asUser(db, ids.member);
    const contributionId = (
      await db.query<{ claim_event_contribution: string }>(
        `select public.claim_event_contribution($1, $2, $3) as claim_event_contribution`,
        [eventId, dessertId, "Brownies"],
      )
    ).rows[0].claim_event_contribution;

    const count = await db.query<{ count: string }>(
      `select count(*)::text as count from public.event_contributions where event_id = $1 and category_id = $2`,
      [eventId, dessertId],
    );
    expect(Number(count.rows[0].count)).toBe(1);

    const row = await db.query<{ label: string; user_id: string }>(
      `select label, user_id from public.event_contributions where id = $1`,
      [contributionId],
    );
    expect(row.rows[0]).toMatchObject({ label: "Brownies", user_id: ids.member });
  });

  it("blocks manual claims on host-bound categories", async () => {
    await asUser(db, ids.member);
    const error = await expectFail(() =>
      db.query(`select public.claim_event_contribution($1, $2, null)`, [eventId, mainId]),
    );
    expect(error).toMatch(/follows the host/i);
  });

  it("lets managers assign and blocks ordinary members", async () => {
    await asUser(db, ids.owner);
    await db.query(`select public.assign_event_contribution_as_manager($1, $2, $3, null)`, [
      eventId,
      dessertId,
      ids.member,
    ]);

    await asUser(db, ids.member);
    const denied = await expectFail(() =>
      db.query(`select public.assign_event_contribution_as_manager($1, $2, $3, null)`, [
        eventId,
        dessertId,
        ids.owner,
      ]),
    );
    expect(denied).toMatch(/not allowed/i);

    const row = await db.query<{ user_id: string; assigned_by: string }>(
      `select user_id, assigned_by from public.event_contributions where event_id = $1 and category_id = $2`,
      [eventId, dessertId],
    );
    expect(row.rows[0]).toMatchObject({ user_id: ids.member, assigned_by: ids.owner });
  });

  it("keeps standing default assignee separate from one-off reassignment", async () => {
    await asUser(db, ids.owner);
    await db.query(
      `update public.contribution_categories set default_assignee_user_id = $1 where id = $2`,
      [ids.owner, dessertId],
    );

    await db.query(`select public.reassign_event_contribution_as_manager(ec.id, $1, null)
      from public.event_contributions ec
      where ec.event_id = $2 and ec.category_id = $3`,
      [ids.member, eventId, dessertId],
    );

    const template = await db.query<{ default_assignee_user_id: string }>(
      `select default_assignee_user_id from public.contribution_categories where id = $1`,
      [dessertId],
    );
    expect(template.rows[0].default_assignee_user_id).toBe(ids.owner);
  });
});
