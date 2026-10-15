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

describe("auto-confirm on consensus", () => {
  beforeAll(async () => {
    db = new PGlite();
    await db.exec(HARNESS_SQL);
    const dir = path.join(process.cwd(), "supabase", "migrations");
    const files = (await readdir(dir)).filter((file) => file.endsWith(".sql")).sort();
    for (const file of files) {
      await db.exec(await readFile(path.join(dir, file), "utf8"));
    }
    ids = {
      owner: await createUser(db, "auto-owner@hui.test", "Owner"),
      member: await createUser(db, "auto-member@hui.test", "Member"),
    };
  }, 90_000);

  afterEach(async () => {
    await asUser(db, null);
  });

  afterAll(async () => {
    await db?.close();
  });

  async function seedProposingEvent(minimumAttendees: number) {
    await asUser(db, ids.owner);
    const groupId = (
      await db.query<{ create_group: string }>(`select public.create_group($1) as create_group`, [
        "Auto group",
      ])
    ).rows[0].create_group;

    await db.query(
      `insert into public.group_memberships (group_id, user_id, role)
       values ($1, $2, 'member')`,
      [groupId, ids.member],
    );

    await pinGroupToMinimumAttendeesConsensus(db, groupId, minimumAttendees);

    const eventId = (
      await db.query<{ id: string }>(
        `insert into public.events (group_id, title, status, created_by)
         values ($1, 'Auto dinner', 'proposing', $2)
         returning id`,
        [groupId, ids.owner],
      )
    ).rows[0].id;

    const candidateId = (
      await db.query<{ id: string }>(
        `insert into public.event_candidates (event_id, group_id, starts_at, proposed_by)
         values ($1, $2, '2026-12-01T10:00:00Z', $3)
         returning id`,
        [eventId, groupId, ids.owner],
      )
    ).rows[0].id;

    return { groupId, eventId, candidateId };
  }

  it("confirms when the last required yes meets minimum_attendees", async () => {
    const { eventId, candidateId } = await seedProposingEvent(2);

    await asUser(db, ids.owner);
    await db.query(
      `insert into public.event_responses (candidate_id, user_id, response, visibility)
       values ($1, $2, 'yes', 'private')`,
      [candidateId, ids.owner],
    );

    let status = await db.query<{ status: string }>(
      `select status::text from public.events where id = $1`,
      [eventId],
    );
    expect(status.rows[0]?.status).toBe("proposing");

    await asUser(db, ids.member);
    await db.query(
      `insert into public.event_responses (candidate_id, user_id, response, visibility)
       values ($1, $2, 'yes', 'private')`,
      [candidateId, ids.member],
    );

    status = await db.query<{ status: string }>(
      `select status::text from public.events where id = $1`,
      [eventId],
    );
    expect(status.rows[0]?.status).toBe("confirmed");

    await db.exec("set role service_role");
    const notifications = await db.query<{ user_id: string }>(
      `select user_id::text from public.member_notifications
       where event_id = $1 and kind = 'event_confirmed'
       order by user_id`,
      [eventId],
    );
    expect(notifications.rows).toHaveLength(2);
    expect(notifications.rows.map((row) => row.user_id).sort()).toEqual(
      [ids.member, ids.owner].sort(),
    );
  });

  it("does not confirm below minimum_attendees", async () => {
    const { eventId, candidateId } = await seedProposingEvent(2);

    await asUser(db, ids.owner);
    await db.query(
      `insert into public.event_responses (candidate_id, user_id, response, visibility)
       values ($1, $2, 'yes', 'private')`,
      [candidateId, ids.owner],
    );

    const status = await db.query<{ status: string }>(
      `select status::text from public.events where id = $1`,
      [eventId],
    );
    expect(status.rows[0]?.status).toBe("proposing");
  });

  it("try_auto_confirm is idempotent", async () => {
    const { eventId, candidateId } = await seedProposingEvent(1);

    await asUser(db, ids.owner);
    await db.query(
      `insert into public.event_responses (candidate_id, user_id, response, visibility)
       values ($1, $2, 'yes', 'private')`,
      [candidateId, ids.owner],
    );
    await asUser(db, ids.member);
    await db.query(
      `insert into public.event_responses (candidate_id, user_id, response, visibility)
       values ($1, $2, 'yes', 'private')`,
      [candidateId, ids.member],
    );

    await db.exec("set role service_role");
    const first = await db.query<{ try_auto_confirm_event: boolean }>(
      `select public.try_auto_confirm_event($1) as try_auto_confirm_event`,
      [eventId],
    );
    expect(first.rows[0]?.try_auto_confirm_event).toBe(false);

    const second = await db.query<{ try_auto_confirm_event: boolean }>(
      `select public.try_auto_confirm_event($1) as try_auto_confirm_event`,
      [eventId],
    );
    expect(second.rows[0]?.try_auto_confirm_event).toBe(false);

    const notifications = await db.query(
      `select 1 from public.member_notifications where event_id = $1 and kind = 'event_confirmed'`,
      [eventId],
    );
    expect(notifications.rows.length).toBeGreaterThanOrEqual(1);
  });

  it("picks the earliest passing candidate on a tie", async () => {
    const { eventId, groupId, candidateId: firstCandidate } = await seedProposingEvent(1);

    await db.query(
      `update public.group_settings set admin_veto_enabled = true where group_id = $1`,
      [groupId],
    );

    const laterId = (
      await db.query<{ id: string }>(
        `insert into public.event_candidates (event_id, group_id, starts_at, proposed_by)
         values ($1, $2, '2026-12-02T10:00:00Z', $3)
         returning id`,
        [eventId, groupId, ids.owner],
      )
    ).rows[0].id;

    const earlierId = (
      await db.query<{ id: string }>(
        `insert into public.event_candidates (event_id, group_id, starts_at, proposed_by)
         values ($1, $2, '2026-12-01T08:00:00Z', $3)
         returning id`,
        [eventId, groupId, ids.owner],
      )
    ).rows[0].id;

    for (const candidateId of [firstCandidate, laterId, earlierId]) {
      await asUser(db, ids.owner);
      await db.query(
        `insert into public.event_responses (candidate_id, user_id, response, visibility)
         values ($1, $2, 'yes', 'private')`,
        [candidateId, ids.owner],
      );
      await asUser(db, ids.member);
      await db.query(
        `insert into public.event_responses (candidate_id, user_id, response, visibility)
         values ($1, $2, 'yes', 'private')`,
        [candidateId, ids.member],
      );
    }

    await db.exec("set role service_role");
    const picked = await db.query<{ pick_auto_confirm_candidate: string }>(
      `select public.pick_auto_confirm_candidate($1) as pick_auto_confirm_candidate`,
      [eventId],
    );
    expect(picked.rows[0]?.pick_auto_confirm_candidate).toBe(earlierId);
  });

  it("does not send duplicate event_confirmed after already confirmed", async () => {
    const { eventId, candidateId } = await seedProposingEvent(1);

    await asUser(db, ids.owner);
    await db.query(
      `insert into public.event_responses (candidate_id, user_id, response, visibility)
       values ($1, $2, 'yes', 'private')`,
      [candidateId, ids.owner],
    );

    await asUser(db, ids.owner);
    await db.query(
      `update public.event_responses set response = 'maybe' where candidate_id = $1 and user_id = $2`,
      [candidateId, ids.owner],
    );

    await db.exec("set role service_role");
    const dupes = await db.query(
      `select user_id
       from public.member_notifications
       where event_id = $1 and kind = 'event_confirmed'
       group by user_id
       having count(*) > 1`,
      [eventId],
    );
    expect(dupes.rows).toHaveLength(0);
  });

  it("skips auto-confirm when admin veto is enabled", async () => {
    const { eventId, candidateId, groupId } = await seedProposingEvent(1);

    await db.query(
      `update public.group_settings set admin_veto_enabled = true where group_id = $1`,
      [groupId],
    );

    await asUser(db, ids.owner);
    await db.query(
      `insert into public.event_responses (candidate_id, user_id, response, visibility)
       values ($1, $2, 'yes', 'private')`,
      [candidateId, ids.owner],
    );

    const status = await db.query<{ status: string }>(
      `select status::text from public.events where id = $1`,
      [eventId],
    );
    expect(status.rows[0]?.status).toBe("proposing");
  });
});
