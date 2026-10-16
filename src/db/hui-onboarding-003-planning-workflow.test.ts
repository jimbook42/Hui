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
returns uuid language sql stable as $$
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
end $$;
grant anon to current_user;
grant authenticated to current_user;
grant service_role to current_user;
grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
select set_config('hui.allow_past_event_candidates', 'on', false);
`;

let db: PGlite;
let ownerId: string;
let memberId: string;
let groupId: string;
let dessertCategoryId: string;

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
     values ($1, jsonb_build_object('display_name', $2::text)) returning id`,
    [email, displayName],
  );
  return created.rows[0].id;
}

describe("HUI-ONBOARDING-003 planning workflow", () => {
  beforeAll(async () => {
    db = new PGlite();
    await db.exec(HARNESS_SQL);
    const dir = path.join(process.cwd(), "supabase", "migrations");
    const files = (await readdir(dir)).filter((file) => file.endsWith(".sql")).sort();
    for (const file of files) {
      await db.exec(await readFile(path.join(dir, file), "utf8"));
    }
    await db.query(`select set_config('hui.skip_auto_confirm', '1', false)`);

    ownerId = await createUser(db, "o003-owner@hui.test", "Owner");
    memberId = await createUser(db, "o003-member@hui.test", "Member");
    await asUser(db, ownerId);
    groupId = (
      await db.query<{ create_group: string }>(`select public.create_group($1) as create_group`, [
        "Planning workflow group",
      ])
    ).rows[0].create_group;
    await db.query(
      `insert into public.group_memberships (group_id, user_id, role) values ($1, $2, 'member')`,
      [groupId, memberId],
    );
    const category = await db.query<{ id: string }>(
      `select id from public.contribution_categories where group_id = $1 and archived_at is null order by name asc limit 1`,
      [groupId],
    );
    if (!category.rows[0]?.id) {
      const inserted = await db.query<{ id: string }>(
        `insert into public.contribution_categories (group_id, name)
         values ($1, 'Dessert') returning id`,
        [groupId],
      );
      dessertCategoryId = inserted.rows[0].id;
    } else {
      dessertCategoryId = category.rows[0].id;
    }
  }, 120_000);

  afterAll(async () => {
    await db?.close();
  });

  it("does not assign a host when a member only records attendance", async () => {
    await asUser(db, ownerId);
    const candidates = JSON.stringify([
      {
        starts_at: wallClockToUtcIso("2033-06-01T12:00", "Pacific/Auckland"),
        ends_at: null,
      },
    ]);
    const eventId = (
      await db.query<{ propose_group_event: string }>(
        `select public.propose_group_event($1, $2, null, null, null, $3::jsonb, false, null, null, null, 'dinner_meal'::public.gathering_type, null, '[]'::jsonb, false) as propose_group_event`,
        [groupId, "No auto host", candidates],
      )
    ).rows[0].propose_group_event;
    const candidateId = (
      await db.query<{ id: string }>(
        `select id from public.event_candidates where event_id = $1 limit 1`,
        [eventId],
      )
    ).rows[0].id;
    await asUser(db, memberId);
    await db.query(
      `insert into public.event_responses (candidate_id, user_id, response, visibility)
       values ($1, $2, 'yes', 'group')`,
      [candidateId, memberId],
    );
    const hosts = await db.query(`select 1 from public.host_assignments where event_id = $1`, [
      eventId,
    ]);
    expect(hosts.rows).toHaveLength(0);
  });

  it("establishes the organiser as accepted host when they opt in during propose", async () => {
    await asUser(db, ownerId);
    const candidates = JSON.stringify([
      {
        starts_at: wallClockToUtcIso("2033-07-01T12:00", "Pacific/Auckland"),
        ends_at: null,
      },
    ]);
    const eventId = (
      await db.query<{ propose_group_event: string }>(
        `select public.propose_group_event($1, $2, null, null, null, $3::jsonb, false, null, null, null, 'dinner_meal'::public.gathering_type, null, '[]'::jsonb, true) as propose_group_event`,
        [groupId, "Organiser hosts", candidates],
      )
    ).rows[0].propose_group_event;
    const host = await db.query<{ user_id: string; status: string }>(
      `select user_id::text, status::text from public.host_assignments where event_id = $1`,
      [eventId],
    );
    expect(host.rows[0]).toMatchObject({ user_id: ownerId, status: "accepted" });
  });

  it("creates requested contribution rows during propose", async () => {
    await asUser(db, ownerId);
    const candidates = JSON.stringify([
      {
        starts_at: wallClockToUtcIso("2033-08-01T12:00", "Pacific/Auckland"),
        ends_at: null,
      },
    ]);
    const requests = JSON.stringify([{ category_id: dessertCategoryId, label: "Pavlova" }]);
    const eventId = (
      await db.query<{ propose_group_event: string }>(
        `select public.propose_group_event($1, $2, null, null, null, $3::jsonb, false, null, null, null, 'dinner_meal'::public.gathering_type, null, $4::jsonb, false) as propose_group_event`,
        [groupId, "With dessert", candidates, requests],
      )
    ).rows[0].propose_group_event;
    const row = await db.query<{ label: string; status: string }>(
      `select label, status::text from public.event_contributions where event_id = $1 and category_id = $2`,
      [eventId, dessertCategoryId],
    );
    expect(row.rows[0]).toMatchObject({ label: "Pavlova", status: "open" });
  });

  it("keeps independent availability per candidate time", async () => {
    await asUser(db, ownerId);
    const candidates = JSON.stringify([
      {
        starts_at: wallClockToUtcIso("2033-09-01T12:00", "Pacific/Auckland"),
        ends_at: null,
      },
      {
        starts_at: wallClockToUtcIso("2033-09-08T12:00", "Pacific/Auckland"),
        ends_at: null,
      },
    ]);
    const eventId = (
      await db.query<{ propose_group_event: string }>(
        `select public.propose_group_event($1, $2, null, null, null, $3::jsonb, false, null, null, null, 'dinner_meal'::public.gathering_type, null, '[]'::jsonb, false) as propose_group_event`,
        [groupId, "Two times", candidates],
      )
    ).rows[0].propose_group_event;
    const candidateRows = await db.query<{ id: string }>(
      `select id from public.event_candidates where event_id = $1 order by starts_at asc`,
      [eventId],
    );
    const [first, second] = candidateRows.rows;
    await asUser(db, memberId);
    await db.query(
      `insert into public.event_responses (candidate_id, user_id, response, visibility)
       values ($1, $2, 'yes', 'group'), ($3, $2, 'no', 'group')`,
      [first.id, memberId, second.id],
    );
    const responses = await db.query<{ candidate_id: string; response: string }>(
      `select candidate_id::text, response::text from public.event_responses
       where user_id = $1 and candidate_id = any($2::uuid[])`,
      [memberId, [first.id, second.id]],
    );
    const byCandidate = new Map(
      responses.rows.map((row) => [row.candidate_id, row.response]),
    );
    expect(byCandidate.get(first.id)).toBe("yes");
    expect(byCandidate.get(second.id)).toBe("no");
    await db.query(
      `update public.event_responses set response = 'maybe' where candidate_id = $1 and user_id = $2`,
      [first.id, memberId],
    );
    const secondOnly = await db.query<{ response: string }>(
      `select response::text from public.event_responses where candidate_id = $1 and user_id = $2`,
      [second.id, memberId],
    );
    expect(secondOnly.rows[0].response).toBe("no");
  });

  it("does not reset canonical recurrence when proposing another recurring hui", async () => {
    await asUser(db, ownerId);
    const recurrence = JSON.stringify({
      series_title: "Rhythm",
      interval_unit: "month",
      interval_count: 2,
      starts_on: "2033-01-15",
      planning_target_date: "2033-01-15",
    });
    const candidates = JSON.stringify([
      {
        starts_at: wallClockToUtcIso("2033-01-15T12:00", "Pacific/Auckland"),
        ends_at: null,
      },
    ]);
    await db.query(
      `select public.propose_group_event($1, $2, null, null, $3::jsonb, $4::jsonb, false, null, null, null, 'dinner_meal'::public.gathering_type, null, '[]'::jsonb, false)`,
      [groupId, "First recurring", recurrence, candidates],
    );
    const seriesAfterFirst = await db.query<{ starts_on: string; interval_count: number }>(
      `select rs.starts_on::text, rs.interval_count
       from public.group_settings gs
       join public.recurrence_series rs on rs.id = gs.canonical_recurrence_series_id
       where gs.group_id = $1`,
      [groupId],
    );
    const recurrence2 = JSON.stringify({
      series_title: "Rhythm",
      interval_unit: "month",
      interval_count: 1,
      starts_on: "2033-03-01",
      planning_target_date: "2033-03-01",
    });
    const candidates2 = JSON.stringify([
      {
        starts_at: wallClockToUtcIso("2033-03-01T12:00", "Pacific/Auckland"),
        ends_at: null,
      },
    ]);
    await db.query(
      `select public.propose_group_event($1, $2, null, null, $3::jsonb, $4::jsonb, false, null, null, null, 'dinner_meal'::public.gathering_type, null, '[]'::jsonb, false)`,
      [groupId, "Second recurring", recurrence2, candidates2],
    );
    const seriesAfterSecond = await db.query<{ starts_on: string; interval_count: number }>(
      `select rs.starts_on::text, rs.interval_count
       from public.group_settings gs
       join public.recurrence_series rs on rs.id = gs.canonical_recurrence_series_id
       where gs.group_id = $1`,
      [groupId],
    );
    expect(seriesAfterSecond.rows[0]).toEqual(seriesAfterFirst.rows[0]);
  });
});
