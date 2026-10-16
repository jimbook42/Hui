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
select set_config('hui.allow_past_event_candidates', 'on', false);
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

function message(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

async function expectFail(run: () => Promise<unknown>): Promise<string> {
  try {
    await run();
  } catch (error) {
    return message(error);
  }
  throw new Error("expected failure");
}

describe("HUI-031-B pause, skip, snapshots", () => {
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
      owner: await createUser(db, "031b-owner@hui.test", "Owner"),
      member: await createUser(db, "031b-member@hui.test", "Member"),
    };
  }, 90_000);

  afterEach(async () => {
    await asUser(db, null);
  });

  afterAll(async () => {
    await db?.close();
  });

  it("restricts skip and pause RPCs to group admins", async () => {
    await asUser(db, ids.owner);
    const groupId = (
      await db.query<{ create_group: string }>(`select public.create_group($1) as create_group`, [
        "Pause skip group",
      ])
    ).rows[0].create_group;

    await db.query(
      `insert into public.group_memberships (group_id, user_id, role)
       values ($1, $2, 'member')`,
      [groupId, ids.member],
    );

    await asUser(db, ids.member);
    const memberSkip = await expectFail(() =>
      db.query(`select public.skip_group_planning_cycle($1, $2::date, null)`, [
        groupId,
        "2026-04-01",
      ]),
    );
    expect(memberSkip.toLowerCase()).toMatch(/admin/);

    await asUser(db, ids.owner);
    await db.query(`select public.skip_group_planning_cycle($1, $2::date, $3)`, [
      groupId,
      "2026-04-01",
      "Holiday",
    ]);

    await asUser(db, ids.member);
    const visible = await db.query<{ nominal_date: string; reason: string | null }>(
      `select nominal_date, reason from public.group_planning_cycle_skips where group_id = $1`,
      [groupId],
    );
    expect(visible.rows).toHaveLength(1);
    expect(visible.rows[0]?.reason).toBe("Holiday");

    await asUser(db, ids.member);
    const memberPause = await expectFail(() =>
      db.query(`select public.set_group_recurrence_paused($1, true)`, [groupId]),
    );
    expect(memberPause.toLowerCase()).toMatch(/admin/);

    await asUser(db, ids.owner);
    await db.query(`select public.set_group_recurrence_paused($1, true)`, [groupId]);

    await asUser(db, ids.member);
    const prefs = await db.query<{ recurrence_paused_at: string | null }>(
      `select recurrence_paused_at from public.group_recurrence_preferences where group_id = $1`,
      [groupId],
    );
    expect(prefs.rows[0]?.recurrence_paused_at).toBeTruthy();
  });

  it("blocks direct skip insert for admins (RPC-only writes) and allows snapshot upsert via RPC", async () => {
    await asUser(db, ids.owner);
    const groupId = (
      await db.query<{ create_group: string }>(`select public.create_group($1) as create_group`, [
        "RLS skip",
      ])
    ).rows[0].create_group;

    await db.query(
      `insert into public.group_memberships (group_id, user_id, role)
       values ($1, $2, 'member')`,
      [groupId, ids.member],
    );

    await asUser(db, ids.owner);
    const insertErr = await expectFail(() =>
      db.query(
        `insert into public.group_planning_cycle_skips (
           group_id, nominal_date, created_by
         ) values ($1, $2::date, $3)`,
        [groupId, "2026-05-01", ids.owner],
      ),
    );
    expect(insertErr.toLowerCase()).toMatch(/policy|permission|denied|violates|privilege/);

    await asUser(db, ids.owner);
    await db.query(`select public.upsert_group_planning_snapshot($1, $2::date, $3::date, $4)`, [
      groupId,
      "2026-05-01",
      "2026-04-17",
      "ready_to_plan",
    ]);

    await asUser(db, ids.member);
    const snap = await db.query<{ phase: string }>(
      `select phase from public.group_planning_cycle_snapshots where group_id = $1`,
      [groupId],
    );
    expect(snap.rows[0]?.phase).toBe("ready_to_plan");
  });

  it("limits refresh_all_group_planning_snapshots to service_role", async () => {
    await asUser(db, ids.owner);
    const denied = await expectFail(() =>
      db.query(`select public.refresh_all_group_planning_snapshots()`),
    );
    expect(denied.toLowerCase()).toMatch(/permission|denied|execute/);

    await db.exec("set role service_role");
    const result = await db.query<{ refresh_all_group_planning_snapshots: number }>(
      `select public.refresh_all_group_planning_snapshots()`,
    );
    expect(result.rows[0]?.refresh_all_group_planning_snapshots).toBeGreaterThanOrEqual(0);
  });
});
