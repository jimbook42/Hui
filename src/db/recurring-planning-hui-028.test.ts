import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { wallClockToUtcIso } from "@/domain/datetime/timezone";

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
let ownerId: string;

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

function recurrencePayload(planningTarget: string) {
  return {
    series_title: "Family dinners",
    interval_unit: "week",
    interval_count: 6,
    starts_on: "2026-01-01",
    planning_target_date: planningTarget,
  };
}

function candidatePayload() {
  return [
    {
      starts_at: wallClockToUtcIso("2026-03-12T12:00", "Pacific/Auckland"),
      ends_at: wallClockToUtcIso("2026-03-12T14:00", "Pacific/Auckland"),
    },
  ];
}

async function createGroup(name: string) {
  await asUser(db, ownerId);
  return (
    await db.query<{ create_group: string }>(`select public.create_group($1) as create_group`, [
      name,
    ])
  ).rows[0].create_group;
}

async function propose(groupId: string, title: string, planningTarget: string) {
  await asUser(db, ownerId);
  return (
    await db.query<{ propose_group_event: string }>(
      `select public.propose_group_event($1, $2, null, null, $3::jsonb, $4::jsonb, false, null, null, null) as propose_group_event`,
      [
        groupId,
        title,
        JSON.stringify(recurrencePayload(planningTarget)),
        JSON.stringify(candidatePayload()),
      ],
    )
  ).rows[0].propose_group_event;
}

describe("recurring planning cycle (HUI-028)", () => {
  beforeAll(async () => {
    db = new PGlite();
    await db.exec(HARNESS_SQL);
    const dir = path.join(process.cwd(), "supabase", "migrations");
    const files = (await readdir(dir)).filter((file) => file.endsWith(".sql")).sort();
    for (const file of files) {
      await db.exec(await readFile(path.join(dir, file), "utf8"));
    }

    ownerId = await createUser(db, "cycle-owner@hui.test", "Cycle Owner");
  }, 60_000);

  afterAll(async () => {
    await db.close();
  });

  it("stores group cadence and reuses canonical series", async () => {
    const groupId = await createGroup("Cycle group");
    const eventId = await propose(groupId, "March dinner", "2026-03-12");

    const settings = await db.query<{
      recurrence_interval_count: number;
      canonical_recurrence_series_id: string;
    }>(
      `select recurrence_interval_count, canonical_recurrence_series_id
       from public.group_settings where group_id = $1`,
      [groupId],
    );
    expect(settings.rows[0].recurrence_interval_count).toBe(6);

    const eventRow = await db.query<{ planning_target_date: string }>(
      `select planning_target_date::text as planning_target_date from public.events where id = $1`,
      [eventId],
    );
    expect(eventRow.rows[0].planning_target_date).toBe("2026-03-12");

    await db.query(
      `update public.events set status = 'cancelled', cancelled_at = now() where id = $1`,
      [eventId],
    );

    const secondId = await propose(groupId, "April dinner", "2026-04-23");
    const second = await db.query<{ recurrence_series_id: string }>(
      `select recurrence_series_id from public.events where id = $1`,
      [secondId],
    );
    expect(second.rows[0].recurrence_series_id).toBe(
      settings.rows[0].canonical_recurrence_series_id,
    );
  });

  it("rejects duplicate planning target for the same cycle", async () => {
    const groupId = await createGroup("Dup group");
    await propose(groupId, "Dup A", "2026-05-01");

    const err = await expectFail(async () => {
      await propose(groupId, "Dup B", "2026-05-01");
    });
    expect(err.toLowerCase()).toContain("already being planned");
  });

  it("does not auto-confirm or set event times on propose", async () => {
    const groupId = await createGroup("Fresh");
    const eventId = await propose(groupId, "One", "2026-06-01");

    const row = await db.query<{ status: string; starts_at: string | null }>(
      `select status, starts_at from public.events where id = $1`,
      [eventId],
    );
    expect(row.rows[0].status).toBe("proposing");
    expect(row.rows[0].starts_at).toBeNull();
  });
});
