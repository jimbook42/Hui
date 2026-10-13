import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { PGlite } from "@electric-sql/pglite";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import {
  deriveGroupPlanningCycle,
  type RecurrenceCadence,
} from "@/domain/recurrence/planning-cycle";

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

type Ids = { owner: string };

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

describe("stale proposing events", () => {
  beforeAll(async () => {
    db = new PGlite();
    await db.exec(HARNESS_SQL);
    const dir = path.join(process.cwd(), "supabase", "migrations");
    const files = (await readdir(dir)).filter((file) => file.endsWith(".sql")).sort();
    for (const file of files) {
      await db.exec(await readFile(path.join(dir, file), "utf8"));
    }
    ids = { owner: await createUser(db, "stale-owner@hui.test", "Owner") };
  }, 90_000);

  afterEach(async () => {
    await asUser(db, null);
  });

  afterAll(async () => {
    await db?.close();
  });

  it("nudges idempotently then auto-cancels after grace and frees the cycle", async () => {
    await asUser(db, ids.owner);
    const groupId = (
      await db.query<{ create_group: string }>(`select public.create_group($1) as create_group`, [
        "Stale group",
      ])
    ).rows[0].create_group;

    await db.query(
      `update public.group_settings
       set recurring_events_enabled = true,
           recurrence_interval_unit = 'week',
           recurrence_interval_count = 1,
           recurrence_anchor_date = '2026-10-01'::date,
           planning_lead_days = 14
       where group_id = $1`,
      [groupId],
    );

    const eventId = (
      await db.query<{ id: string }>(
        `insert into public.events (
           group_id, title, status, created_by, planning_target_date
         ) values ($1, 'Past proposal', 'proposing', $2, '2026-10-05'::date)
         returning id`,
        [groupId, ids.owner],
      )
    ).rows[0].id;

    await db.exec("set role service_role");

    const dayAfter = await db.query<{ nudges_queued: number; proposals_cancelled: number }>(
      `select * from public.process_stale_proposals('2026-10-06'::date, 3)`,
    );
    expect(dayAfter.rows[0]?.nudges_queued).toBe(1);
    expect(dayAfter.rows[0]?.proposals_cancelled).toBe(0);

    const again = await db.query<{ nudges_queued: number; proposals_cancelled: number }>(
      `select * from public.process_stale_proposals('2026-10-06'::date, 3)`,
    );
    expect(again.rows[0]?.nudges_queued).toBe(0);

    const beforeGrace = await db.query<{ nudges_queued: number; proposals_cancelled: number }>(
      `select * from public.process_stale_proposals('2026-10-07'::date, 3)`,
    );
    expect(beforeGrace.rows[0]?.proposals_cancelled).toBe(0);

    const afterGrace = await db.query<{ nudges_queued: number; proposals_cancelled: number }>(
      `select * from public.process_stale_proposals('2026-10-08'::date, 3)`,
    );
    expect(afterGrace.rows[0]?.proposals_cancelled).toBe(1);

    const status = await db.query<{ status: string }>(
      `select status::text from public.events where id = $1`,
      [eventId],
    );
    expect(status.rows[0]?.status).toBe("cancelled");

    await asUser(db, ids.owner);
    const notifications = await db.query<{ kind: string }>(
      `select kind::text from public.member_notifications where event_id = $1 order by created_at`,
      [eventId],
    );
    expect(notifications.rows.map((r) => r.kind)).toEqual([
      "stale_proposal_passed",
      "event_cancelled",
    ]);

    const cadence: RecurrenceCadence = {
      intervalUnit: "week",
      intervalCount: 1,
      anchorDate: "2026-10-01",
    };
    const cycle = deriveGroupPlanningCycle({
      recurringEnabled: true,
      cadence,
      planningLeadDays: 14,
      todayDateOnly: "2026-10-08",
      events: [],
    });
    expect(cycle.phase).not.toBe("planning_exists");
    expect(cycle.blockingEventId).toBeNull();
  });

  it("reschedule_proposing_event_nominal updates planning target for organiser", async () => {
    await asUser(db, ids.owner);
    const groupId = (
      await db.query<{ create_group: string }>(`select public.create_group($1) as create_group`, [
        "Reschedule group",
      ])
    ).rows[0].create_group;

    const eventId = (
      await db.query<{ id: string }>(
        `insert into public.events (
           group_id, title, status, created_by, planning_target_date
         ) values ($1, 'Stale', 'proposing', $2, '2026-10-01'::date)
         returning id`,
        [groupId, ids.owner],
      )
    ).rows[0].id;

    await db.query(`select public.reschedule_proposing_event_nominal($1, '2026-10-20'::date)`, [
      eventId,
    ]);

    const row = await db.query<{ planning_target_date: string }>(
      `select planning_target_date::text from public.events where id = $1`,
      [eventId],
    );
    expect(row.rows[0]?.planning_target_date).toBe("2026-10-20");
  });
});
