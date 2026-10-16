import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { PGlite } from "@electric-sql/pglite";

import { pinGroupToMinimumAttendeesConsensus } from "@/db/pin-group-consensus-for-tests";
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

async function seedConfirmedEvent(
  database: PGlite,
  ownerId: string,
  groupId: string,
  planningTarget: string | null,
  startsAt: string,
  endsAt: string,
) {
  await asUser(database, ownerId);

  const eventId = (
    await database.query<{ id: string }>(
      `insert into public.events (
         group_id, title, status, created_by, planning_target_date
       ) values ($1, 'Reschedule dinner', 'proposing', $2, $3::date)
       returning id`,
      [groupId, ownerId, planningTarget],
    )
  ).rows[0].id;

  const candidateId = (
    await database.query<{ id: string }>(
      `insert into public.event_candidates (
         event_id, group_id, starts_at, ends_at, proposed_by
       ) values ($1, $2, $3::timestamptz, $4::timestamptz, $5)
       returning id`,
      [eventId, groupId, startsAt, endsAt, ownerId],
    )
  ).rows[0].id;

  await database.query(
    `insert into public.event_responses (candidate_id, user_id, response, visibility)
     values ($1, $2, 'yes', 'private')`,
    [candidateId, ownerId],
  );

  await database.query(`select public.finalise_event($1::uuid, $2::uuid)`, [
    eventId,
    candidateId,
  ]);

  return { eventId, candidateId };
}

describe("reschedule confirmed hui", () => {
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
      owner: await createUser(db, "resched-owner@hui.test", "Owner"),
      member: await createUser(db, "resched-member@hui.test", "Member"),
    };
  }, 90_000);

  afterEach(async () => {
    await asUser(db, null);
  });

  afterAll(async () => {
    await db?.close();
  });

  it("moves confirmed time, clears responses, audits, and notifies members", async () => {
    await asUser(db, ids.owner);
    const groupId = (
      await db.query<{ create_group: string }>(`select public.create_group($1) as create_group`, [
        "Reschedule group",
      ])
    ).rows[0].create_group;

    await pinGroupToMinimumAttendeesConsensus(db, groupId);

    await db.query(
      `insert into public.group_memberships (group_id, user_id, role)
       values ($1, $2, 'member')`,
      [groupId, ids.member],
    );

    const { eventId, candidateId } = await seedConfirmedEvent(
      db,
      ids.owner,
      groupId,
      "2026-11-01",
      "2026-11-01T10:00:00+00",
      "2026-11-01T12:00:00+00",
    );

    await asUser(db, ids.member);
    await db.query(
      `insert into public.event_responses (candidate_id, user_id, response, visibility)
       values ($1, $2, 'yes', 'private')`,
      [candidateId, ids.member],
    );

    await asUser(db, ids.owner);
    const auditId = (
      await db.query<{ reschedule_confirmed_event_to_time: string }>(
        `select public.reschedule_confirmed_event_to_time(
           $1::uuid,
           '2026-11-08T10:00:00+00'::timestamptz,
           '2026-11-08T12:00:00+00'::timestamptz
         ) as reschedule_confirmed_event_to_time`,
        [eventId],
      )
    ).rows[0]?.reschedule_confirmed_event_to_time;

    expect(auditId).toBeTruthy();

    const event = await db.query<{ starts_at: string; planning_target_date: string }>(
      `select starts_at::text, planning_target_date::text from public.events where id = $1`,
      [eventId],
    );
    if (event.rows[0]?.planning_target_date) {
      expect(event.rows[0]?.planning_target_date).toBe("2026-11-01");
    }
    expect(event.rows[0]?.starts_at).toContain("2026-11-08");

    const responses = await db.query(`select 1 from public.event_responses where candidate_id = $1`, [
      candidateId,
    ]);
    expect(responses.rows).toHaveLength(0);

    await asUser(db, null);
    const notifications = await db.query<{ kind: string }>(
      `select kind::text from public.member_notifications where event_id = $1`,
      [eventId],
    );
    expect(notifications.rows.length).toBeGreaterThan(0);

    const audit = await db.query<{ mode: string }>(
      `select mode from public.event_reschedule_audit where id = $1`,
      [auditId],
    );
    expect(audit.rows[0]?.mode).toBe("new_time");
  });

  it("reopens confirmed hui to proposing without changing planning nominal", async () => {
    await asUser(db, ids.owner);
    const groupId = (
      await db.query<{ create_group: string }>(`select public.create_group($1) as create_group`, [
        "Reopen group",
      ])
    ).rows[0].create_group;

    await pinGroupToMinimumAttendeesConsensus(db, groupId);

    const { eventId, candidateId } = await seedConfirmedEvent(
      db,
      ids.owner,
      groupId,
      "2026-12-01",
      "2026-12-01T10:00:00+00",
      "2026-12-01T12:00:00+00",
    );

    await db.query(
      `insert into public.group_memberships (group_id, user_id, role)
       values ($1, $2, 'member')`,
      [groupId, ids.member],
    );

    await asUser(db, ids.member);
    await db.query(
      `insert into public.event_responses (candidate_id, user_id, response, visibility)
       values ($1, $2, 'yes', 'private')`,
      [candidateId, ids.member],
    );

    await asUser(db, ids.owner);
    await db.query(`select public.reopen_confirmed_event_for_proposing($1::uuid)`, [eventId]);

    await asUser(db, null);
    const reopenNotice = await db.query<{ body: string }>(
      `select body from public.member_notifications
       where event_id = $1 and user_id = $2 and kind = 'event_rescheduled'
       order by created_at desc limit 1`,
      [eventId, ids.member],
    );
    expect(reopenNotice.rows[0]?.body).toContain("Reschedule dinner");
    expect(reopenNotice.rows[0]?.body).toContain("Reopen group");

    const row = await db.query<{ status: string; planning_target_date: string; starts_at: string | null }>(
      `select status::text, planning_target_date::text, starts_at::text
       from public.events where id = $1`,
      [eventId],
    );
    expect(row.rows[0]?.status).toBe("proposing");
    expect(row.rows[0]?.planning_target_date).toBe("2026-12-01");
    expect(row.rows[0]?.starts_at).toBeNull();

    const active = await db.query<{ status: string }>(
      `select status::text as status from public.event_candidates
       where event_id = $1 and status in ('proposed', 'selected')`,
      [eventId],
    );
    expect(active.rows).toHaveLength(0);

    const withdrawn = await db.query<{ status: string }>(
      `select status::text as status from public.event_candidates
       where event_id = $1 and status = 'withdrawn'`,
      [eventId],
    );
    expect(withdrawn.rows.length).toBeGreaterThan(0);

    await asUser(db, null);
    const audit = await db.query<{ from_starts_at: string | null }>(
      `select from_starts_at::text from public.event_reschedule_audit
       where event_id = $1 order by created_at desc limit 1`,
      [eventId],
    );
    expect(audit.rows[0]?.from_starts_at).toContain("2026-12-01");
  });
});
