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
`;

let db: PGlite;

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

describe("profiles auth and RLS", () => {
  beforeAll(async () => {
    db = new PGlite();
    await db.exec(HARNESS_SQL);
    const migrationsDir = path.join(process.cwd(), "supabase", "migrations");
    const files = (await readdir(migrationsDir)).filter((file) => file.endsWith(".sql"));
    files.sort();
    for (const file of files) {
      const sql = await readFile(path.join(migrationsDir, file), "utf8");
      await db.exec(sql);
    }
  }, 60_000);

  afterAll(async () => {
    await db.close();
  });

  it("lets a user insert their own profile when the trigger row is missing", async () => {
    const userId = await createUser(db, "solo@hui.test", "Solo");
    await asUser(db, null);
    await db.query(`delete from public.profiles where id = $1`, [userId]);

    await asUser(db, userId);
    const inserted = await db.query<{ display_name: string }>(
      `insert into public.profiles (id, display_name)
       values ($1, 'Solo User')
       returning display_name`,
      [userId],
    );
    expect(inserted.rows[0].display_name).toBe("Solo User");
  });

  it("treats profile initialisation as idempotent at the database layer", async () => {
    const userId = await createUser(db, "dup@hui.test", "Dup");
    await asUser(db, null);
    await db.query(`delete from public.profiles where id = $1`, [userId]);

    await asUser(db, userId);
    await db.query(
      `insert into public.profiles (id, display_name) values ($1, 'First')`,
      [userId],
    );
    await expect(
      db.query(
        `insert into public.profiles (id, display_name) values ($1, 'Second')`,
        [userId],
      ),
    ).rejects.toThrow();
  });

  it("allows users to update their own display name", async () => {
    const userId = await createUser(db, "rename@hui.test", "Before");
    await asUser(db, userId);
    const updated = await db.query<{ display_name: string }>(
      `update public.profiles set display_name = 'After' where id = $1 returning display_name`,
      [userId],
    );
    expect(updated.rows[0].display_name).toBe("After");
  });

  it("blocks updates to another user's profile", async () => {
    const owner = await createUser(db, "owner@hui.test", "Owner");
    const other = await createUser(db, "other@hui.test", "Other");

    await asUser(db, other);
    const blocked = await db.query(
      `update public.profiles set display_name = 'Hacked' where id = $1 returning id`,
      [owner],
    );
    expect(blocked.rows).toEqual([]);
  });

  it("blocks inserting a profile for another auth user", async () => {
    const owner = await createUser(db, "real@hui.test", "Real");
    const other = await createUser(db, "fake@hui.test", "Fake");

    await asUser(db, other);
    await expect(
      db.query(
        `insert into public.profiles (id, display_name) values ($1, 'Stolen')`,
        [owner],
      ),
    ).rejects.toThrow();
  });
});
