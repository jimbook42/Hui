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

describe("HUI-030 hardening", () => {
  beforeAll(async () => {
    db = new PGlite();
    await db.exec(HARNESS_SQL);
    const dir = path.join(process.cwd(), "supabase", "migrations");
    const files = (await readdir(dir)).filter((file) => file.endsWith(".sql")).sort();
    for (const file of files) {
      await db.exec(await readFile(path.join(dir, file), "utf8"));
    }
    ids = {
      owner: await createUser(db, "h030-owner@hui.test", "Owner"),
      member: await createUser(db, "h030-member@hui.test", "Member"),
    };
  }, 90_000);

  afterEach(async () => {
    await asUser(db, null);
  });

  afterAll(async () => {
    await db?.close();
  });

  it("defaults planning reminders to admins only", async () => {
    await asUser(db, ids.owner);
    const groupId = (
      await db.query<{ create_group: string }>(`select public.create_group($1) as create_group`, [
        "Planning reminders",
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
           planning_lead_days = 14
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
    await db.query(`select public.enqueue_planning_cycle_nudges('2026-10-06'::date)`);

    const memberNote = await db.query(
      `select 1 from public.member_notifications
       where group_id = $1 and user_id = $2 and kind = 'planning_cycle_opens'`,
      [groupId, ids.member],
    );
    expect(memberNote.rows).toHaveLength(0);

    const ownerNote = await db.query(
      `select 1 from public.member_notifications
       where group_id = $1 and user_id = $2 and kind = 'planning_cycle_opens'`,
      [groupId, ids.owner],
    );
    expect(ownerNote.rows).toHaveLength(1);
  });

  it("stores organiser confirmation method on force finalise", async () => {
    await db.query(`select set_config('hui.skip_auto_confirm', '1', false)`);
    await asUser(db, ids.owner);
    const groupId = (
      await db.query<{ create_group: string }>(`select public.create_group($1) as create_group`, [
        "Force method",
      ])
    ).rows[0].create_group;

    await db.query(
      `update public.group_settings
       set consensus_rule = 'majority_active_members', minimum_attendees = 1
       where group_id = $1`,
      [groupId],
    );

    const eventId = (
      await db.query<{ id: string }>(
        `insert into public.events (group_id, title, status, created_by)
         values ($1, 'Test', 'proposing', $2) returning id`,
        [groupId, ids.owner],
      )
    ).rows[0].id;

    const candidateId = (
      await db.query<{ id: string }>(
        `insert into public.event_candidates (event_id, group_id, starts_at, proposed_by)
         values ($1, $2, '2026-12-01T10:00:00Z', $3) returning id`,
        [eventId, groupId, ids.owner],
      )
    ).rows[0].id;

    await db.query(
      `insert into public.event_responses (candidate_id, user_id, response, visibility)
       values ($1, $2, 'yes', 'private')`,
      [candidateId, ids.owner],
    );

    await db.query(`select public.finalise_event($1, $2, true)`, [eventId, candidateId]);

    const method = await db.query<{ confirmation_method: string }>(
      `select confirmation_method::text from public.events where id = $1`,
      [eventId],
    );
    expect(method.rows[0]?.confirmation_method).toBe("organiser");
  });
});
