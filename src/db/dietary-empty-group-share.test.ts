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

let db: PGlite;
let ownerId = "";
let memberId = "";
let groupId = "";

describe("dietary: empty group share (HUI-0185)", () => {
  beforeAll(async () => {
    db = new PGlite();
    await db.exec(HARNESS_SQL);

    const dir = path.join(process.cwd(), "supabase", "migrations");
    const files = (await readdir(dir)).filter((file) => file.endsWith(".sql")).sort();
    for (const file of files) {
      await db.exec(await readFile(path.join(dir, file), "utf8"));
    }
    await db.query(`select set_config('hui.skip_auto_confirm', '1', false)`);

    ownerId = await createUser(db, "empty-owner@hui.test", "Group Owner");
    memberId = await createUser(db, "empty-member@hui.test", "Departing Member");

    await asUser(db, ownerId);
    groupId = (
      await db.query<{ create_group: string }>(`select public.create_group($1) as create_group`, [
        "Empty share group",
      ])
    ).rows[0].create_group;

    await asUser(db, ownerId);
    await db.query(
      `insert into public.group_memberships (group_id, user_id, role) values ($1, $2, 'member')`,
      [groupId, memberId],
    );
  }, 60_000);

  afterEach(async () => {
    await asUser(db, null);
    await db.query(`delete from public.dietary_empty_group_shares`);
    await db.query(
      `insert into public.group_memberships (group_id, user_id, role)
       select $1, $2, 'member'
       where not exists (
         select 1 from public.group_memberships where group_id = $1 and user_id = $2
       )`,
      [groupId, memberId],
    );
  });

  afterAll(async () => {
    await db?.close();
  });

  async function listFor(viewer: string) {
    await asUser(db, viewer);
    const result = await db.query<{ label: string; scope: string; user_id: string }>(
      `select label, scope, user_id from public.list_group_dietary($1) order by label`,
      [groupId],
    );
    return result.rows;
  }

  it("lists an active member empty share, then hides it after they leave the group", async () => {
    await asUser(db, memberId);
    await db.query(
      `insert into public.dietary_empty_group_shares (user_id, group_id) values ($1, $2)`,
      [memberId, groupId],
    );

    expect(await listFor(ownerId)).toEqual([
      {
        label: "No dietary requirements",
        scope: "empty",
        user_id: memberId,
      },
    ]);

    await asUser(db, null);
    await db.query(`delete from public.group_memberships where group_id = $1 and user_id = $2`, [
      groupId,
      memberId,
    ]);

    expect(await listFor(ownerId)).toEqual([]);
  });
});
