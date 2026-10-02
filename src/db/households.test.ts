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
  other: string;
  outsider: string;
};

let db: PGlite;
let ids: Ids;
let groupId: string;

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

describe("households (HUI-016)", () => {
  beforeAll(async () => {
    db = new PGlite();
    await db.exec(HARNESS_SQL);

    const dir = path.join(process.cwd(), "supabase", "migrations");
    const files = (await readdir(dir)).filter((file) => file.endsWith(".sql")).sort();
    for (const file of files) {
      await db.exec(await readFile(path.join(dir, file), "utf8"));
    }

    ids = {
      owner: await createUser(db, "household-owner@hui.test", "Olivia Owner"),
      member: await createUser(db, "household-member@hui.test", "Mia Member"),
      other: await createUser(db, "household-other@hui.test", "Owen Other"),
      outsider: await createUser(db, "household-outsider@hui.test", "Omar Outsider"),
    };

    await asUser(db, ids.owner);
    groupId = (
      await db.query<{ create_group: string }>(`select public.create_group($1) as create_group`, [
        "Household group",
      ])
    ).rows[0].create_group;

    await asUser(db, ids.owner);
    await db.query(
      `insert into public.group_memberships (group_id, user_id, role)
       values ($1, $2, 'member'), ($1, $3, 'member')`,
      [groupId, ids.member, ids.other],
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

  it("creates a household and adds the creator as a member", async () => {
    await asUser(db, ids.member);
    const householdId = (
      await db.query<{ create_household: string }>(
        `select public.create_household($1, $2) as create_household`,
        [groupId, "Tull household"],
      )
    ).rows[0].create_household;

    const members = await db.query<{ user_id: string }>(
      `select user_id from public.household_members where household_id = $1`,
      [householdId],
    );

    expect(members.rows).toEqual([{ user_id: ids.member }]);
  });

  it("rejects invalid household names and duplicate membership", async () => {
    await asUser(db, ids.other);
    const empty = await expectFail(() =>
      db.query(`select public.create_household($1, $2)`, [groupId, "   "]),
    );
    expect(empty).toMatch(/between 1 and 80/);

    await db.query(`select public.create_household($1, $2)`, [groupId, "Other home"]);
    const duplicate = await expectFail(() =>
      db.query(`select public.create_household($1, $2)`, [groupId, "Another"]),
    );
    expect(duplicate).toMatch(/already in a household/);
  });

  it("lets household members rename, add, and remove members", async () => {
    await asUser(db, ids.member);
    const householdId = (
      await db.query<{ household_id: string }>(
        `select household_id from public.household_members where user_id = $1 and group_id = $2`,
        [ids.member, groupId],
      )
    ).rows[0].household_id;

    await db.query(`select public.update_household_name($1, $2)`, [
      householdId,
      "Isaac & Alice",
    ]);

    await db.query(`select public.add_household_member($1, $2)`, [householdId, ids.owner]);

    const count = await db.query<{ count: string }>(
      `select count(*)::text as count from public.household_members where household_id = $1`,
      [householdId],
    );
    expect(Number(count.rows[0].count)).toBe(2);

    await db.query(`select public.remove_household_member($1, $2)`, [householdId, ids.owner]);
    const afterRemove = await db.query<{ count: string }>(
      `select count(*)::text as count from public.household_members where household_id = $1`,
      [householdId],
    );
    expect(Number(afterRemove.rows[0].count)).toBe(1);
  });

  it("rejects duplicate household membership for another user", async () => {
    await asUser(db, ids.member);
    const householdId = (
      await db.query<{ household_id: string }>(
        `select household_id from public.household_members where user_id = $1`,
        [ids.member],
      )
    ).rows[0].household_id;

    const error = await expectFail(() =>
      db.query(`select public.add_household_member($1, $2)`, [householdId, ids.member]),
    );
    expect(error).toMatch(/already a household member/);
  });

  it("blocks unrelated users from mutating a household", async () => {
    await asUser(db, ids.member);
    const householdId = (
      await db.query<{ household_id: string }>(
        `select household_id from public.household_members where user_id = $1`,
        [ids.member],
      )
    ).rows[0].household_id;

    await asUser(db, ids.outsider);
    const rename = await expectFail(() =>
      db.query(`select public.update_household_name($1, $2)`, [householdId, "Hacked"]),
    );
    expect(rename).toMatch(/not a household member/);

    await asUser(db, ids.other);
    const add = await expectFail(() =>
      db.query(`select public.add_household_member($1, $2)`, [householdId, ids.other]),
    );
    expect(add).toMatch(/not a household member/);
  });

  it("allows active group members to read households but not outsiders", async () => {
    await asUser(db, ids.owner);
    const visible = await db.query(`select id from public.households where group_id = $1`, [
      groupId,
    ]);
    expect(visible.rows.length).toBeGreaterThan(0);

    await asUser(db, ids.outsider);
    const hidden = await db.query(`select id from public.households where group_id = $1`, [
      groupId,
    ]);
    expect(hidden.rows).toEqual([]);
  });

  it("blocks direct table writes from authenticated clients", async () => {
    await asUser(db, ids.member);
    const error = await expectFail(() =>
      db.query(`insert into public.households (group_id, name) values ($1, $2)`, [
        groupId,
        "Direct",
      ]),
    );
    expect(error).toMatch(/permission denied/i);
  });

  it("removes household rows when the last member leaves", async () => {
    await asUser(db, ids.owner);
    const householdId = (
      await db.query<{ create_household: string }>(
        `select public.create_household($1, $2) as create_household`,
        [groupId, "Solo household"],
      )
    ).rows[0].create_household;

    await db.query(`select public.remove_household_member($1, $2)`, [householdId, ids.owner]);

    await asUser(db, null);
    const remaining = await db.query(`select id from public.households where id = $1`, [
      householdId,
    ]);
    expect(remaining.rows).toEqual([]);
  });
});
