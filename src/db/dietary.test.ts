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
let groupA: string;
let groupB: string;

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

async function visibleGroupShareCount(database: PGlite, groupId: string): Promise<number> {
  const result = await database.query<{ count: string }>(
    `select count(*)::text as count from public.dietary_entry_shares where group_id = $1`,
    [groupId],
  );
  return Number(result.rows[0].count);
}

async function canSeeEntry(
  database: PGlite,
  entryId: string,
): Promise<boolean> {
  const result = await database.query(`select id from public.dietary_entries where id = $1`, [
    entryId,
  ]);
  return result.rows.length > 0;
}

describe("dietary privacy (HUI-019)", () => {
  beforeAll(async () => {
    db = new PGlite();
    await db.exec(HARNESS_SQL);

    const dir = path.join(process.cwd(), "supabase", "migrations");
    const files = (await readdir(dir)).filter((file) => file.endsWith(".sql")).sort();
    for (const file of files) {
      await db.exec(await readFile(path.join(dir, file), "utf8"));
    }

    ids = {
      owner: await createUser(db, "diet-owner@hui.test", "Olivia Owner"),
      admin: await createUser(db, "diet-admin@hui.test", "Ada Admin"),
      member: await createUser(db, "diet-member@hui.test", "Mia Member"),
      outsider: await createUser(db, "diet-outsider@hui.test", "Omar Outsider"),
    };

    await asUser(db, ids.owner);
    groupA = (
      await db.query<{ create_group: string }>(`select public.create_group($1) as create_group`, [
        "Family A",
      ])
    ).rows[0].create_group;

    await db.query(
      `insert into public.group_memberships (group_id, user_id, role) values ($1, $2, 'admin')`,
      [groupA, ids.admin],
    );
    await db.query(
      `insert into public.group_memberships (group_id, user_id, role) values ($1, $2, 'member')`,
      [groupA, ids.member],
    );

    groupB = (
      await db.query<{ create_group: string }>(`select public.create_group($1) as create_group`, [
        "Friends B",
      ])
    ).rows[0].create_group;
  }, 60_000);

  afterEach(async () => {
    if (db) {
      await asUser(db, null);
    }
  });

  afterAll(async () => {
    await db?.close();
  });

  it("lets owners read private entries and hides them from other members", async () => {
    await asUser(db, ids.member);
    const privateEntry = await db.query<{ id: string }>(
      `insert into public.dietary_entries (user_id, category, label)
       values ($1, 'requirement', 'Vegetarian')
       returning id`,
      [ids.member],
    );
    const entryId = privateEntry.rows[0].id;

    const ownerRead = await db.query(`select id from public.dietary_entries where id = $1`, [
      entryId,
    ]);
    expect(ownerRead.rows).toHaveLength(1);

    await asUser(db, ids.admin);
    const adminRead = await db.query(`select id from public.dietary_entries where id = $1`, [
      entryId,
    ]);
    expect(adminRead.rows).toEqual([]);

    await asUser(db, ids.owner);
    const ownerPeerRead = await db.query(`select id from public.dietary_entries where id = $1`, [
      entryId,
    ]);
    expect(ownerPeerRead.rows).toEqual([]);

    expect(await visibleGroupShareCount(db, groupA)).toBe(0);
  });

  it("allows share, group read, unshare, and blocks outsiders", async () => {
    await asUser(db, ids.member);
    const entry = await db.query<{ id: string }>(
      `insert into public.dietary_entries (user_id, category, label)
       values ($1, 'requirement', 'Gluten-free')
       returning id`,
      [ids.member],
    );
    const entryId = entry.rows[0].id;

    await db.query(
      `insert into public.dietary_entry_shares (dietary_entry_id, group_id) values ($1, $2)`,
      [entryId, groupA],
    );

    await asUser(db, ids.owner);
    const visible = await db.query<{ label: string }>(
      `select d.label
       from public.dietary_entry_shares sh
       join public.dietary_entries d on d.id = sh.dietary_entry_id
       where sh.group_id = $1`,
      [groupA],
    );
    expect(visible.rows.map((row) => row.label)).toContain("Gluten-free");

    await asUser(db, ids.outsider);
    const outsider = await db.query(
      `select d.id
       from public.dietary_entry_shares sh
       join public.dietary_entries d on d.id = sh.dietary_entry_id
       where sh.group_id = $1`,
      [groupA],
    );
    expect(outsider.rows).toEqual([]);

    await asUser(db, ids.member);
    await db.query(
      `delete from public.dietary_entry_shares
       where dietary_entry_id = $1 and group_id = $2`,
      [entryId, groupA],
    );

    await asUser(db, ids.owner);
    expect(await visibleGroupShareCount(db, groupA)).toBe(0);
  });

  it("isolates shares per group", async () => {
    await asUser(db, ids.member);
    const entry = await db.query<{ id: string }>(
      `insert into public.dietary_entries (user_id, category, label)
       values ($1, 'allergy', 'Peanuts')
       returning id`,
      [ids.member],
    );
    const entryId = entry.rows[0].id;
    await db.query(
      `insert into public.dietary_entry_shares (dietary_entry_id, group_id) values ($1, $2)`,
      [entryId, groupA],
    );

    await asUser(db, ids.owner);
    expect(await visibleGroupShareCount(db, groupA)).toBeGreaterThanOrEqual(1);
    expect(await visibleGroupShareCount(db, groupB)).toBe(0);
  });

  it("blocks another member from sharing or editing someone else's entry", async () => {
    await asUser(db, ids.owner);
    const entry = await db.query<{ id: string }>(
      `insert into public.dietary_entries (user_id, category, label)
       values ($1, 'preference', 'Spicy')
       returning id`,
      [ids.owner],
    );
    const entryId = entry.rows[0].id;

    await asUser(db, ids.member);
    const shareError = await expectFail(() =>
      db.query(
        `insert into public.dietary_entry_shares (dietary_entry_id, group_id) values ($1, $2)`,
        [entryId, groupA],
      ),
    );
    expect(shareError.toLowerCase()).toMatch(/row-level security|permission denied/);

    const update = await db.query(
      `update public.dietary_entries set label = 'Hacked' where id = $1 returning id`,
      [entryId],
    );
    expect(update.rows).toEqual([]);
  });

  it("hides shared entries after the owner is removed from the group", async () => {
    const leaver = await createUser(db, "diet-leaver@hui.test", "Lea Leaver");
    await asUser(db, ids.owner);
    await db.query(
      `insert into public.group_memberships (group_id, user_id, role) values ($1, $2, 'member')`,
      [groupA, leaver],
    );

    await asUser(db, leaver);
    const entry = await db.query<{ id: string }>(
      `insert into public.dietary_entries (user_id, category, label)
       values ($1, 'requirement', 'No dairy')
       returning id`,
      [leaver],
    );
    const entryId = entry.rows[0].id;
    await db.query(
      `insert into public.dietary_entry_shares (dietary_entry_id, group_id) values ($1, $2)`,
      [entryId, groupA],
    );

    await asUser(db, ids.owner);
    expect(await canSeeEntry(db, entryId)).toBe(true);
    const beforeRemoval = await db.query(
      `select dietary_entry_id from public.dietary_entry_shares
       where group_id = $1 and dietary_entry_id = $2`,
      [groupA, entryId],
    );
    expect(beforeRemoval.rows).toHaveLength(1);

    await db.query(
      `update public.group_memberships
       set status = 'removed', removed_at = now()
       where group_id = $1 and user_id = $2`,
      [groupA, leaver],
    );

    const afterRemoval = await db.query(
      `select dietary_entry_id from public.dietary_entry_shares
       where group_id = $1 and dietary_entry_id = $2`,
      [groupA, entryId],
    );
    expect(afterRemoval.rows).toEqual([]);
    expect(await canSeeEntry(db, entryId)).toBe(false);

    await asUser(db, leaver);
    expect(await canSeeEntry(db, entryId)).toBe(true);
  });
});
