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

type Ids = { owner: string; member: string };

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

describe("HUI-031-D planning cycle cron", () => {
  beforeAll(async () => {
    db = new PGlite();
    await db.exec(HARNESS_SQL);
    const dir = path.join(process.cwd(), "supabase", "migrations");
    const files = (await readdir(dir)).filter((file) => file.endsWith(".sql")).sort();
    for (const file of files) {
      await db.exec(await readFile(path.join(dir, file), "utf8"));
    }
    await db.query(`select set_config('hui.skip_auto_confirm', '1', false)`);

    ids = {
      owner: await createUser(db, "031d-owner@hui.test", "Owner"),
      member: await createUser(db, "031d-member@hui.test", "Member"),
    };
  }, 90_000);

  afterEach(async () => {
    await asUser(db, null);
  });

  afterAll(async () => {
    await db?.close();
  });

  it("enqueues idempotent planning nudges and skips when paused", async () => {
    await asUser(db, ids.owner);
    const groupId = (
      await db.query<{ create_group: string }>(`select public.create_group($1) as create_group`, [
        "Cron group",
      ])
    ).rows[0].create_group;

    await db.query(
      `insert into public.group_memberships (group_id, user_id, role)
       values ($1, $2, 'member')`,
      [groupId, ids.member],
    );

    await db.query(
      `update public.group_settings
       set recurring_events_enabled = true,
           recurrence_interval_unit = 'week',
           recurrence_interval_count = 1,
           recurrence_anchor_date = '2026-10-19'::date,
           planning_lead_days = 14,
           who_may_propose = 'admins_only'
       where group_id = $1`,
      [groupId],
    );

    await db.exec("set role service_role");
    await db.query(
      `insert into public.group_planning_cycle_snapshots (
         group_id, next_nominal_date, planning_opens_on, phase
       ) values ($1, '2026-10-19'::date, '2026-10-05'::date, 'ready_to_plan')`,
      [groupId],
    );
    const first = await db.query<{ enqueue_planning_cycle_nudges: number }>(
      `select public.enqueue_planning_cycle_nudges('2026-10-06'::date) as enqueue_planning_cycle_nudges`,
    );
    expect(first.rows[0]?.enqueue_planning_cycle_nudges).toBe(1);

    const second = await db.query<{ enqueue_planning_cycle_nudges: number }>(
      `select public.enqueue_planning_cycle_nudges('2026-10-06'::date) as enqueue_planning_cycle_nudges`,
    );
    expect(second.rows[0]?.enqueue_planning_cycle_nudges).toBe(0);

    await asUser(db, ids.owner);
    await db.query(`select public.set_group_recurrence_paused($1, true)`, [groupId]);
    await db.exec("set role service_role");

    const paused = await db.query<{ enqueue_planning_cycle_nudges: number }>(
      `select public.enqueue_planning_cycle_nudges('2026-10-06'::date) as enqueue_planning_cycle_nudges`,
    );
    expect(paused.rows[0]?.enqueue_planning_cycle_nudges).toBe(0);

    await asUser(db, ids.owner);
    const rows = await db.query<{ kind: string }>(
      `select kind::text from public.member_notifications where group_id = $1`,
      [groupId],
    );
    expect(rows.rows.some((row) => row.kind === "planning_cycle_opens")).toBe(true);
  });

  it("refresh_all_group_planning_snapshots returns eligible recurring group count", async () => {
    await db.exec("set role service_role");
    const result = await db.query<{ refresh_all_group_planning_snapshots: number }>(
      `select public.refresh_all_group_planning_snapshots() as refresh_all_group_planning_snapshots`,
    );
    expect(result.rows[0]?.refresh_all_group_planning_snapshots).toBeGreaterThanOrEqual(1);
  });
});
