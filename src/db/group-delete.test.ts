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

describe("delete_group", () => {
  let db: PGlite;

  beforeAll(async () => {
    db = new PGlite();
    await db.exec(HARNESS_SQL);
    const dir = path.join(process.cwd(), "supabase", "migrations");
    const files = (await readdir(dir)).filter((name) => name.endsWith(".sql")).sort();
    for (const file of files) {
      await db.exec(await readFile(path.join(dir, file), "utf8"));
    }
  }, 60_000);

  afterAll(async () => {
    await db.close();
  });

  it("lets the owner delete the group and blocks other members", async () => {
    const owner = await createUser(db, "owner-delete@test", "Owner");
    const member = await createUser(db, "member-delete@test", "Member");

    await asUser(db, owner);
    const created = await db.query<{ create_group: string }>(
      `select public.create_group('Dinner club') as create_group`,
    );
    const groupId = created.rows[0]!.create_group;

    await asUser(db, owner);
    await db.query(
      `insert into public.group_memberships (group_id, user_id, role, status) values ($1, $2, 'member', 'active')`,
      [groupId, member],
    );

    await asUser(db, member);
    await expect(db.query(`select public.delete_group($1)`, [groupId])).rejects.toThrow(
      /only the owner can delete/i,
    );

    await asUser(db, owner);
    await db.query(`select public.delete_group($1)`, [groupId]);

    const remaining = await db.query(`select 1 from public.groups where id = $1`, [groupId]);
    expect(remaining.rows).toHaveLength(0);
  });

  it("deletes a group with recurrence settings and an active event", async () => {
    const owner = await createUser(db, "owner-rich-delete@test", "Owner");
    await asUser(db, owner);
    const created = await db.query<{ create_group: string }>(
      `select public.create_group('Delete me club') as create_group`,
    );
    const groupId = created.rows[0]!.create_group;

    const candidate = JSON.stringify([
      { starts_at: "2026-11-01T00:00:00.000Z", ends_at: null },
    ]);
    const recurrence = JSON.stringify({
      series_title: "Monthly dinners",
      interval_unit: "month",
      interval_count: 1,
      starts_on: "2026-11-01",
      planning_target_date: "2026-11-01",
    });

    await db.query(
      `select public.propose_group_event($1, $2, null, null, $3::jsonb, $4::jsonb, false, null, null, null, 'dinner_meal'::public.gathering_type, null)`,
      [groupId, "November dinner", recurrence, candidate],
    );

    await db.query(`select public.get_group_invite_link($1)`, [groupId]);

    await asUser(db, owner);
    await db.query(`select public.delete_group($1)`, [groupId]);

    const remaining = await db.query(`select 1 from public.groups where id = $1`, [groupId]);
    expect(remaining.rows).toHaveLength(0);

    const settings = await db.query(`select 1 from public.group_settings where group_id = $1`, [
      groupId,
    ]);
    expect(settings.rows).toHaveLength(0);
  });
});
