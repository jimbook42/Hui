import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { PGlite } from "@electric-sql/pglite";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { pinGroupToMinimumAttendeesConsensus } from "@/db/pin-group-consensus-for-tests";

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

type Ids = { owner: string; member: string; lurker: string };

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

describe("event cancel and reopen notifications", () => {
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
      owner: await createUser(db, "cancel-owner@hui.test", "Owner"),
      member: await createUser(db, "cancel-member@hui.test", "Member"),
      lurker: await createUser(db, "cancel-lurker@hui.test", "Lurker"),
    };
  }, 90_000);

  afterEach(async () => {
    await asUser(db, null);
  });

  afterAll(async () => {
    await db?.close();
  });

  it("notifies active members on manual cancel except the canceller", async () => {
    await asUser(db, ids.owner);
    const groupId = (
      await db.query<{ create_group: string }>(`select public.create_group($1) as create_group`, [
        "Cancel notify group",
      ])
    ).rows[0].create_group;

    await pinGroupToMinimumAttendeesConsensus(db, groupId);

    await db.query(
      `insert into public.group_memberships (group_id, user_id, role)
       values ($1, $2, 'member'), ($1, $3, 'member')`,
      [groupId, ids.member, ids.lurker],
    );

    const eventId = (
      await db.query<{ id: string }>(
        `insert into public.events (
           group_id, title, status, created_by, planning_target_date
         ) values ($1, 'Potluck', 'proposing', $2, '2026-11-20'::date)
         returning id`,
        [groupId, ids.owner],
      )
    ).rows[0].id;

    const candidateId = (
      await db.query<{ id: string }>(
        `insert into public.event_candidates (
           event_id, group_id, starts_at, ends_at, proposed_by
         ) values ($1, $2, '2026-11-20T18:00:00Z', '2026-11-20T20:00:00Z', $3)
         returning id`,
        [eventId, groupId, ids.owner],
      )
    ).rows[0].id;

    await asUser(db, ids.member);
    await db.query(
      `insert into public.event_responses (candidate_id, user_id, response, visibility)
       values ($1, $2, 'yes', 'private')`,
      [candidateId, ids.member],
    );

    await asUser(db, ids.owner);
    await db.query(
      `update public.events
       set status = 'cancelled', cancelled_at = now()
       where id = $1`,
      [eventId],
    );

    await asUser(db, ids.member);
    const memberNote = await db.query<{ kind: string; body: string }>(
      `select kind::text, body from public.member_notifications
       where user_id = $1 and event_id = $2 and kind = 'event_cancelled'`,
      [ids.member, eventId],
    );
    expect(memberNote.rows).toHaveLength(1);
    expect(memberNote.rows[0].body).toContain("Hui cancelled: Potluck on");

    await asUser(db, ids.lurker);
    const lurkerNote = await db.query(
      `select 1 from public.member_notifications
       where user_id = $1 and event_id = $2 and kind = 'event_cancelled'`,
      [ids.lurker, eventId],
    );
    expect(lurkerNote.rows).toHaveLength(1);

    await asUser(db, ids.owner);
    const ownerNote = await db.query(
      `select 1 from public.member_notifications
       where user_id = $1 and event_id = $2 and kind = 'event_cancelled'`,
      [ids.owner, eventId],
    );
    expect(ownerNote.rows).toHaveLength(0);
  });

  it("notifies attendees only when a confirmed hui is reopened for planning", async () => {
    await asUser(db, ids.owner);
    const groupId = (
      await db.query<{ create_group: string }>(`select public.create_group($1) as create_group`, [
        "Reopen notify group",
      ])
    ).rows[0].create_group;

    await pinGroupToMinimumAttendeesConsensus(db, groupId);

    await db.query(
      `insert into public.group_memberships (group_id, user_id, role)
       values ($1, $2, 'member'), ($1, $3, 'member')`,
      [groupId, ids.member, ids.lurker],
    );

    await db.query(
      `update public.group_settings set minimum_attendees = 1 where group_id = $1`,
      [groupId],
    );

    const eventId = (
      await db.query<{ id: string }>(
        `insert into public.events (
           group_id, title, status, created_by, planning_target_date
         ) values ($1, 'Dinner', 'proposing', $2, '2026-12-01'::date)
         returning id`,
        [groupId, ids.owner],
      )
    ).rows[0].id;

    const candidateId = (
      await db.query<{ id: string }>(
        `insert into public.event_candidates (
           event_id, group_id, starts_at, ends_at, proposed_by
         ) values ($1, $2, '2026-12-01T10:00:00Z', '2026-12-01T12:00:00Z', $3)
         returning id`,
        [eventId, groupId, ids.owner],
      )
    ).rows[0].id;

    await db.query(
      `insert into public.event_responses (candidate_id, user_id, response, visibility)
       values ($1, $2, 'yes', 'private')`,
      [candidateId, ids.owner],
    );

    await db.query(`select public.finalise_event($1::uuid, $2::uuid)`, [eventId, candidateId]);

    await asUser(db, ids.member);
    await db.query(
      `insert into public.event_responses (candidate_id, user_id, response, visibility)
       values ($1, $2, 'yes', 'private')`,
      [candidateId, ids.member],
    );

    await asUser(db, ids.owner);
    await db.query(`select public.reopen_confirmed_event_for_proposing($1::uuid)`, [eventId]);

    await asUser(db, ids.member);
    const attendee = await db.query<{ kind: string }>(
      `select kind::text from public.member_notifications
       where user_id = $1 and event_id = $2 and kind = 'event_rescheduled'`,
      [ids.member, eventId],
    );
    expect(attendee.rows).toHaveLength(1);

    await asUser(db, ids.lurker);
    const lurker = await db.query(
      `select 1 from public.member_notifications
       where user_id = $1 and event_id = $2 and kind = 'event_rescheduled'`,
      [ids.lurker, eventId],
    );
    expect(lurker.rows).toHaveLength(0);
  });
});
