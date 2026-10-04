import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { PGlite } from "@electric-sql/pglite";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

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


type Ids = { sharer: string; peerA: string; peerB: string; peerC: string; outsider: string };

let db: PGlite;
let ids: Ids;
let groupA = "";
let groupB = "";
let groupC = "";

async function createGroupAs(userId: string, name: string): Promise<string> {
  await asUser(db, userId);
  return (
    await db.query<{ create_group: string }>(`select public.create_group($1) as create_group`, [name])
  ).rows[0].create_group;
}

async function addMember(adminId: string, groupId: string, userId: string) {
  await asUser(db, adminId);
  await db.query(
    `insert into public.group_memberships (group_id, user_id, role) values ($1, $2, 'member')`,
    [groupId, userId],
  );
}

async function createEntry(label: string): Promise<string> {
  await asUser(db, ids.sharer);
  return (
    await db.query<{ id: string }>(
      `insert into public.dietary_entries (user_id, category, label)
       values ($1, 'requirement', $2) returning id`,
      [ids.sharer, label],
    )
  ).rows[0].id;
}

async function shareWithGroup(entryId: string, groupId: string) {
  await asUser(db, ids.sharer);
  await db.query(
    `insert into public.dietary_entry_shares (dietary_entry_id, group_id) values ($1, $2)`,
    [entryId, groupId],
  );
}

async function setAllGroups(userId: string, entryId: string, enabled: boolean): Promise<number> {
  await asUser(db, userId);
  const result = await db.query(
    `update public.dietary_entries set share_with_all_groups = $2 where id = $1 returning id`,
    [entryId, enabled],
  );
  return result.rows.length;
}

/** What `viewer` sees for `groupId` through the group listing function. */
async function listFor(viewer: string, groupId: string) {
  await asUser(db, viewer);
  const result = await db.query<{ label: string; scope: string }>(
    `select label, scope from public.list_group_dietary($1) order by label`,
    [groupId],
  );
  return result.rows;
}

async function canReadEntry(viewer: string, entryId: string): Promise<boolean> {
  await asUser(db, viewer);
  const result = await db.query(`select id from public.dietary_entries where id = $1`, [entryId]);
  return result.rows.length > 0;
}

describe("dietary: share with all my groups (HUI-026U.3)", () => {
  beforeAll(async () => {
    db = new PGlite();
    await db.exec(HARNESS_SQL);

    const dir = path.join(process.cwd(), "supabase", "migrations");
    const files = (await readdir(dir)).filter((file) => file.endsWith(".sql")).sort();
    for (const file of files) {
      await db.exec(await readFile(path.join(dir, file), "utf8"));
    }

    ids = {
      sharer: await createUser(db, "all-sharer@hui.test", "Sam Sharer"),
      peerA: await createUser(db, "all-peer-a@hui.test", "Ana Peer"),
      peerB: await createUser(db, "all-peer-b@hui.test", "Ben Peer"),
      peerC: await createUser(db, "all-peer-c@hui.test", "Cat Peer"),
      outsider: await createUser(db, "all-outsider@hui.test", "Omar Outsider"),
    };

    groupA = await createGroupAs(ids.sharer, "Group A");
    groupB = await createGroupAs(ids.sharer, "Group B");
    groupC = await createGroupAs(ids.peerC, "Group C");
    await addMember(ids.sharer, groupA, ids.peerA);
    await addMember(ids.sharer, groupB, ids.peerB);
  }, 60_000);

  beforeEach(async () => {
    // Each case starts from a clean slate: no entries, and the sharer is not in group C.
    await asUser(db, null);
    await db.query(`delete from public.dietary_entries`);
    await db.query(`delete from public.group_memberships where group_id = $1 and user_id = $2`, [
      groupC,
      ids.sharer,
    ]);
  });

  afterEach(async () => {
    if (db) {
      await asUser(db, null);
    }
  });

  afterAll(async () => {
    await db?.close();
  });

  it("is off by default and never shares existing entries", async () => {
    const entryId = await createEntry("Default private");
    await asUser(db, ids.sharer);
    const flag = await db.query<{ share_with_all_groups: boolean }>(
      `select share_with_all_groups from public.dietary_entries where id = $1`,
      [entryId],
    );
    expect(flag.rows[0].share_with_all_groups).toBe(false);
    expect(await listFor(ids.peerA, groupA)).toEqual([]);
    expect(await listFor(ids.peerB, groupB)).toEqual([]);
    expect(await canReadEntry(ids.peerA, entryId)).toBe(false);
  });

  it("group-only sharing reaches that group and no other", async () => {
    const entryId = await createEntry("Group only");
    await shareWithGroup(entryId, groupA);

    expect(await listFor(ids.peerA, groupA)).toEqual([{ label: "Group only", scope: "group" }]);
    expect(await listFor(ids.peerB, groupB)).toEqual([]);
    expect(await canReadEntry(ids.peerA, entryId)).toBe(true);
    expect(await canReadEntry(ids.peerB, entryId)).toBe(false);
  });

  it("all-groups sharing reaches every group the owner is in, and nobody else", async () => {
    const entryId = await createEntry("Everywhere");
    expect(await setAllGroups(ids.sharer, entryId, true)).toBe(1);

    expect(await listFor(ids.peerA, groupA)).toEqual([{ label: "Everywhere", scope: "all_groups" }]);
    expect(await listFor(ids.peerB, groupB)).toEqual([{ label: "Everywhere", scope: "all_groups" }]);
    expect(await canReadEntry(ids.peerA, entryId)).toBe(true);
    expect(await canReadEntry(ids.peerB, entryId)).toBe(true);

    // A group the sharer is not in, and people who share no group with them, see nothing.
    expect(await listFor(ids.peerC, groupC)).toEqual([]);
    expect(await canReadEntry(ids.peerC, entryId)).toBe(false);
    expect(await canReadEntry(ids.outsider, entryId)).toBe(false);
    // Non-members cannot list a group they are not in.
    expect(await listFor(ids.peerC, groupA)).toEqual([]);
  });

  it("includes groups the owner joins later", async () => {
    const entryId = await createEntry("Joins later");
    await setAllGroups(ids.sharer, entryId, true);
    expect(await listFor(ids.peerC, groupC)).toEqual([]);

    await addMember(ids.peerC, groupC, ids.sharer);
    expect(await listFor(ids.peerC, groupC)).toEqual([{ label: "Joins later", scope: "all_groups" }]);
    expect(await canReadEntry(ids.peerC, entryId)).toBe(true);

    // Leaving the group takes it back out of that group straight away.
    await asUser(db, null);
    await db.query(`delete from public.group_memberships where group_id = $1 and user_id = $2`, [
      groupC,
      ids.sharer,
    ]);
    expect(await listFor(ids.peerC, groupC)).toEqual([]);
    expect(await canReadEntry(ids.peerC, entryId)).toBe(false);
  });

  it("turning it off is reversible and restores group-only visibility", async () => {
    const entryId = await createEntry("Reversible");
    await shareWithGroup(entryId, groupA);
    await setAllGroups(ids.sharer, entryId, true);
    expect(await listFor(ids.peerB, groupB)).toEqual([{ label: "Reversible", scope: "all_groups" }]);
    // Where it was already shared specifically, that wins as the scope.
    expect(await listFor(ids.peerA, groupA)).toEqual([{ label: "Reversible", scope: "group" }]);

    await setAllGroups(ids.sharer, entryId, false);
    expect(await listFor(ids.peerB, groupB)).toEqual([]);
    expect(await canReadEntry(ids.peerB, entryId)).toBe(false);
    // The earlier group-specific share is untouched.
    expect(await listFor(ids.peerA, groupA)).toEqual([{ label: "Reversible", scope: "group" }]);

    await asUser(db, ids.sharer);
    const shares = await db.query(
      `select group_id from public.dietary_entry_shares where dietary_entry_id = $1`,
      [entryId],
    );
    expect(shares.rows).toHaveLength(1);
  });

  it("keeps other entries group-only when one entry goes to all groups", async () => {
    const everywhere = await createEntry("Open entry");
    const private_ = await createEntry("Stays private");
    const groupOnly = await createEntry("Stays in A");
    await shareWithGroup(groupOnly, groupA);
    await setAllGroups(ids.sharer, everywhere, true);

    expect((await listFor(ids.peerB, groupB)).map((row) => row.label)).toContain("Open entry");
    expect((await listFor(ids.peerB, groupB)).map((row) => row.label)).not.toContain("Stays in A");
    expect((await listFor(ids.peerB, groupB)).map((row) => row.label)).not.toContain("Stays private");
    expect(await canReadEntry(ids.peerA, private_)).toBe(false);
  });

  it("only the owner can change the setting", async () => {
    const entryId = await createEntry("Owner only");
    expect(await setAllGroups(ids.peerA, entryId, true)).toBe(0);
    expect(await setAllGroups(ids.outsider, entryId, true)).toBe(0);
    expect(await canReadEntry(ids.peerB, entryId)).toBe(false);

    await asUser(db, ids.peerA);
    const forged = await expectFail(() =>
      db.query(
        `insert into public.dietary_entries (user_id, category, label, share_with_all_groups)
         values ($1, 'requirement', 'Forged', true)`,
        [ids.sharer],
      ),
    );
    expect(forged).toMatch(/policy|permission|denied/i);
  });

  it("does not let outsiders list a group they are not in", async () => {
    const entryId = await createEntry("Hidden from outsiders");
    await setAllGroups(ids.sharer, entryId, true);
    expect(await listFor(ids.outsider, groupA)).toEqual([]);
  });
});