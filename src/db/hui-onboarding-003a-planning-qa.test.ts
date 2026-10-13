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
`;

let db: PGlite;
let ownerId: string;
let memberId: string;
let groupId: string;
let saladCategoryId: string;
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

async function proposeEvent(
  title: string,
  candidates: object[],
  extra: {
    contributions?: object[];
    organiserHosts?: boolean;
    recurrence?: object | null;
  } = {},
) {
  const contributions = JSON.stringify(extra.contributions ?? []);
  const recurrence = extra.recurrence === undefined ? null : extra.recurrence;
  return (
    await db.query<{ propose_group_event: string }>(
      `select public.propose_group_event(
         $1, $2, null, null, $3::jsonb, $4::jsonb, false, null, null, null,
         'dinner_meal'::public.gathering_type, null, $5::jsonb, $6
       ) as propose_group_event`,
      [
        groupId,
        title,
        recurrence ? JSON.stringify(recurrence) : null,
        JSON.stringify(candidates),
        contributions,
        extra.organiserHosts ?? false,
      ],
    )
  ).rows[0].propose_group_event;
}

async function respondYes(userId: string, candidateId: string) {
  await asUser(db, userId);
  await db.query(
    `insert into public.event_responses (candidate_id, user_id, response, visibility)
     values ($1, $2, 'yes', 'group')
     on conflict (candidate_id, user_id) do update set response = excluded.response`,
    [candidateId, userId],
  );
}

describe("HUI-ONBOARDING-003A planning QA fixes", () => {
  beforeAll(async () => {
    db = new PGlite();
    await db.exec(HARNESS_SQL);
    const dir = path.join(process.cwd(), "supabase", "migrations");
    const files = (await readdir(dir)).filter((file) => file.endsWith(".sql")).sort();
    for (const file of files) {
      await db.exec(await readFile(path.join(dir, file), "utf8"));
    }
    await db.query(`select set_config('hui.skip_auto_confirm', '1', false)`);

    ownerId = await createUser(db, "o003a-owner@hui.test", "Owner");
    memberId = await createUser(db, "o003a-member@hui.test", "Member");
    await asUser(db, ownerId);
    groupId = (
      await db.query<{ create_group: string }>(`select public.create_group($1) as create_group`, [
        "QA fixes group",
      ])
    ).rows[0].create_group;
    await db.query(
      `insert into public.group_memberships (group_id, user_id, role) values ($1, $2, 'member')`,
      [groupId, memberId],
    );
    const salad = await db.query<{ id: string }>(
      `insert into public.contribution_categories (group_id, name)
       values ($1, 'Salad') returning id`,
      [groupId],
    );
    saladCategoryId = salad.rows[0].id;
    const dessert = await db.query<{ id: string }>(
      `insert into public.contribution_categories (group_id, name)
       values ($1, 'Dessert') returning id`,
      [groupId],
    );
    dessertCategoryId = dessert.rows[0].id;
  }, 120_000);

  afterAll(async () => {
    await db?.close();
  });

  it("finalises with a pending host proposal when no host was accepted", async () => {
    await asUser(db, ownerId);
    const candidates = [
      { starts_at: wallClockToUtcIso("2034-01-10T12:00", "Pacific/Auckland"), ends_at: null },
    ];
    const eventId = await proposeEvent("Host after finalise", candidates);
    const candidateId = (
      await db.query<{ id: string }>(
        `select id from public.event_candidates where event_id = $1 limit 1`,
        [eventId],
      )
    ).rows[0].id;
    await respondYes(ownerId, candidateId);
    await respondYes(memberId, candidateId);
    await asUser(db, ownerId);
    await db.query(`select public.finalise_event($1, $2)`, [eventId, candidateId]);

    const hosts = await db.query<{ status: string }>(
      `select status::text from public.host_assignments where event_id = $1`,
      [eventId],
    );
    expect(hosts.rows.some((row) => row.status === "proposed")).toBe(true);
    expect(hosts.rows.some((row) => row.status === "accepted")).toBe(false);
  });

  it("does not add a competing host proposal when organiser already hosts", async () => {
    await asUser(db, ownerId);
    const candidates = [
      { starts_at: wallClockToUtcIso("2034-02-10T12:00", "Pacific/Auckland"), ends_at: null },
    ];
    const eventId = await proposeEvent("Organiser hosts", candidates, { organiserHosts: true });
    const candidateId = (
      await db.query<{ id: string }>(
        `select id from public.event_candidates where event_id = $1 limit 1`,
        [eventId],
      )
    ).rows[0].id;
    await respondYes(ownerId, candidateId);
    await respondYes(memberId, candidateId);
    await asUser(db, ownerId);
    await db.query(`select public.finalise_event($1, $2)`, [eventId, candidateId]);

    const hosts = await db.query<{ user_id: string; status: string }>(
      `select user_id::text, status::text from public.host_assignments where event_id = $1`,
      [eventId],
    );
    expect(hosts.rows).toHaveLength(1);
    expect(hosts.rows[0]).toMatchObject({ user_id: ownerId, status: "accepted" });
  });

  it("does not create duplicate host proposals when finalise is retried idempotently", async () => {
    await asUser(db, ownerId);
    const candidates = [
      { starts_at: wallClockToUtcIso("2034-03-10T12:00", "Pacific/Auckland"), ends_at: null },
    ];
    const eventId = await proposeEvent("No duplicate hosts", candidates);
    const candidateId = (
      await db.query<{ id: string }>(
        `select id from public.event_candidates where event_id = $1 limit 1`,
        [eventId],
      )
    ).rows[0].id;
    await respondYes(ownerId, candidateId);
    await respondYes(memberId, candidateId);
    await asUser(db, ownerId);
    await db.query(`select public.finalise_event($1, $2)`, [eventId, candidateId]);

    const firstCount = (
      await db.query<{ n: string }>(
        `select count(*)::text as n from public.host_assignments
         where event_id = $1 and status = 'proposed'`,
        [eventId],
      )
    ).rows[0].n;

    await expect(
      db.query(`select public.finalise_event($1, $2)`, [eventId, candidateId]),
    ).rejects.toThrow();

    const secondCount = (
      await db.query<{ n: string }>(
        `select count(*)::text as n from public.host_assignments
         where event_id = $1 and status = 'proposed'`,
        [eventId],
      )
    ).rows[0].n;
    expect(secondCount).toBe(firstCount);
  });

  it("attaches only requested contributions at propose and does not seed all categories on finalise", async () => {
    await asUser(db, ownerId);
    const candidates = [
      { starts_at: wallClockToUtcIso("2034-04-10T12:00", "Pacific/Auckland"), ends_at: null },
    ];
    const eventId = await proposeEvent("Subset contributions", candidates, {
      contributions: [{ category_id: saladCategoryId, label: "Green salad" }],
    });
    const candidateId = (
      await db.query<{ id: string }>(
        `select id from public.event_candidates where event_id = $1 limit 1`,
        [eventId],
      )
    ).rows[0].id;
    await respondYes(ownerId, candidateId);
    await respondYes(memberId, candidateId);
    await asUser(db, ownerId);
    await db.query(`select public.finalise_event($1, $2)`, [eventId, candidateId]);

    const rows = await db.query<{ category_id: string }>(
      `select category_id::text from public.event_contributions where event_id = $1`,
      [eventId],
    );
    expect(rows.rows.map((row) => row.category_id)).toEqual([saladCategoryId]);
  });

  it("rejects a duplicate planning target for the same cycle", async () => {
    await asUser(db, ownerId);
    const recurrence = {
      series_title: "Rhythm",
      interval_unit: "month",
      interval_count: 1,
      starts_on: "2034-05-15",
      planning_target_date: "2034-05-15",
    };
    const candidates = [
      { starts_at: wallClockToUtcIso("2034-05-15T12:00", "Pacific/Auckland"), ends_at: null },
    ];
    await proposeEvent("First cycle", candidates, { recurrence });

    await expect(
      proposeEvent("Duplicate cycle", candidates, { recurrence }),
    ).rejects.toThrow(/already being planned/i);
  });

  it("apply_proposal_contribution_requests is idempotent on duplicate category ids", async () => {
    await asUser(db, ownerId);
    const candidates = [
      { starts_at: wallClockToUtcIso("2034-06-10T12:00", "Pacific/Auckland"), ends_at: null },
    ];
    const eventId = await proposeEvent("Dup request", candidates, {
      contributions: [
        { category_id: dessertCategoryId, label: "Pav" },
        { category_id: dessertCategoryId, label: "Pav duplicate" },
      ],
    });
    const count = (
      await db.query<{ n: string }>(
        `select count(*)::text as n from public.event_contributions
         where event_id = $1 and category_id = $2`,
        [eventId, dessertCategoryId],
      )
    ).rows[0].n;
    expect(count).toBe("1");
  });
});
