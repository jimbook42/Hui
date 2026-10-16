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
  if (typeof error === "object" && error && "message" in error) {
    return String(error.message);
  }
  return String(error);
}

async function expectFail(run: () => Promise<unknown>): Promise<string> {
  try {
    await run();
  } catch (error) {
    return message(error);
  }
  throw new Error("expected the statement to fail");
}

describe("HUI-COORD lifecycle audit", () => {
  beforeAll(async () => {
    db = new PGlite();
    await db.exec(HARNESS_SQL);
    const dir = path.join(process.cwd(), "supabase", "migrations");
    const files = (await readdir(dir)).filter((file) => file.endsWith(".sql")).sort();
    for (const file of files) {
      await db.exec(await readFile(path.join(dir, file), "utf8"));
    }
    ids = {
      owner: await createUser(db, "coord-owner@hui.test", "Owner"),
      member: await createUser(db, "coord-member@hui.test", "Member"),
    };
    await db.query(`select set_config('hui.skip_auto_confirm', '1', false)`);
  }, 120_000);

  afterEach(async () => {
    await asUser(db, null);
    await db.query(`select set_config('hui.skip_auto_confirm', '1', false)`);
  });

  afterAll(async () => {
    await db?.close();
  });

  it("clears response_deadline_at on confirm and skips deadline reminders", async () => {
    await asUser(db, ids.owner);
    const groupId = (
      await db.query<{ create_group: string }>(`select public.create_group($1) as create_group`, [
        "Coord deadline",
      ])
    ).rows[0].create_group;
    await pinGroupToMinimumAttendeesConsensus(db, groupId, 1);
    await db.query(
      `insert into public.group_memberships (group_id, user_id, role) values ($1, $2, 'member')`,
      [groupId, ids.member],
    );

    const eventId = (
      await db.query<{ id: string }>(
        `insert into public.events (group_id, title, status, created_by)
         values ($1, 'Deadline dinner', 'proposing', $2) returning id`,
        [groupId, ids.owner],
      )
    ).rows[0].id;

    await db.query(
      `update public.events
       set response_deadline_at = '2026-06-02T12:00:00Z'::timestamptz
       where id = $1`,
      [eventId],
    );

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

    await db.query(`select public.finalise_event($1, $2)`, [eventId, candidateId]);

    const deadline = await db.query<{ response_deadline_at: string | null }>(
      `select response_deadline_at::text from public.events where id = $1`,
      [eventId],
    );
    expect(deadline.rows[0]?.response_deadline_at).toBeNull();

    await db.exec("set role service_role");
    const queued = await db.query<{ enqueue_proposal_deadline_reminders: number }>(
      `select public.enqueue_proposal_deadline_reminders('2026-06-01T12:00:00Z'::timestamptz) as enqueue_proposal_deadline_reminders`,
    );
    expect(queued.rows[0]?.enqueue_proposal_deadline_reminders).toBe(0);
  });

  it("keeps a confirmed hui confirmed when a member later declines", async () => {
    await asUser(db, ids.owner);
    const groupId = (
      await db.query<{ create_group: string }>(`select public.create_group($1) as create_group`, [
        "Stay confirmed",
      ])
    ).rows[0].create_group;
    await pinGroupToMinimumAttendeesConsensus(db, groupId, 1);
    await db.query(
      `insert into public.group_memberships (group_id, user_id, role) values ($1, $2, 'member')`,
      [groupId, ids.member],
    );

    const eventId = (
      await db.query<{ id: string }>(
        `insert into public.events (group_id, title, status, created_by)
         values ($1, 'Potluck', 'proposing', $2) returning id`,
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

    await db.query(`select public.finalise_event($1, $2)`, [eventId, candidateId]);

    await asUser(db, ids.member);
    await db.query(
      `insert into public.event_responses (candidate_id, user_id, response, visibility)
       values ($1, $2, 'no', 'private')`,
      [candidateId, ids.member],
    );

    const status = await db.query<{ status: string }>(
      `select status::text from public.events where id = $1`,
      [eventId],
    );
    expect(status.rows[0]?.status).toBe("confirmed");
  });

  it("rejects answers on withdrawn candidates while proposing", async () => {
    await db.query(`select set_config('hui.skip_auto_confirm', '1', false)`);
    await asUser(db, ids.owner);
    const groupId = (
      await db.query<{ create_group: string }>(`select public.create_group($1) as create_group`, [
        "Withdrawn slot",
      ])
    ).rows[0].create_group;
    await pinGroupToMinimumAttendeesConsensus(db, groupId, 1);

    const eventId = (
      await db.query<{ id: string }>(
        `insert into public.events (group_id, title, status, created_by)
         values ($1, 'Two times', 'proposing', $2) returning id`,
        [groupId, ids.owner],
      )
    ).rows[0].id;

    const activeId = (
      await db.query<{ id: string }>(
        `insert into public.event_candidates (event_id, group_id, starts_at, proposed_by)
         values ($1, $2, '2026-12-02T10:00:00Z', $3) returning id`,
        [eventId, groupId, ids.owner],
      )
    ).rows[0].id;

    const withdrawnId = (
      await db.query<{ id: string }>(
        `insert into public.event_candidates (event_id, group_id, starts_at, proposed_by, status)
         values ($1, $2, '2026-12-01T10:00:00Z', $3, 'withdrawn') returning id`,
        [eventId, groupId, ids.owner],
      )
    ).rows[0].id;

    await db.query(
      `insert into public.group_memberships (group_id, user_id, role) values ($1, $2, 'member')`,
      [groupId, ids.member],
    );

    await asUser(db, ids.member);
    const error = await expectFail(() =>
      db.query(
        `insert into public.event_responses (candidate_id, user_id, response, visibility)
         values ($1, $2, 'yes', 'private')`,
        [withdrawnId, ids.member],
      ),
    );
    expect(error).toMatch(/no longer open for scheduling/i);

    await asUser(db, ids.member);
    await db.query(
      `insert into public.event_responses (candidate_id, user_id, response, visibility)
       values ($1, $2, 'yes', 'private')`,
      [activeId, ids.member],
    );
  });

  it("auto-cancel stale proposals notify members once via the cancel trigger", async () => {
    await db.query(`select set_config('hui.skip_auto_confirm', '1', false)`);
    await asUser(db, ids.owner);
    const groupId = (
      await db.query<{ create_group: string }>(`select public.create_group($1) as create_group`, [
        "Stale once",
      ])
    ).rows[0].create_group;
    await pinGroupToMinimumAttendeesConsensus(db, groupId, 1);
    await db.query(
      `insert into public.group_memberships (group_id, user_id, role) values ($1, $2, 'member')`,
      [groupId, ids.member],
    );

    const eventId = (
      await db.query<{ id: string }>(
        `insert into public.events (
           group_id, title, status, created_by, planning_target_date
         ) values ($1, 'Past', 'proposing', $2, '2026-10-05'::date) returning id`,
        [groupId, ids.owner],
      )
    ).rows[0].id;

    await db.exec("set role service_role");
    await db.query(`select * from public.process_stale_proposals('2026-10-08'::date, 3)`);

    const cancelled = await db.query<{ kind: string; count: string }>(
      `select kind::text, count(*)::text as count
       from public.member_notifications
       where event_id = $1 and kind = 'event_cancelled'
       group by kind`,
      [eventId],
    );
    expect(Number(cancelled.rows[0]?.count ?? 0)).toBe(2);
  });

  it("manual finalise and try_auto_confirm race leaves a single confirmation", async () => {
    await db.query(`select set_config('hui.skip_auto_confirm', '1', false)`);
    await asUser(db, ids.owner);
    const groupId = (
      await db.query<{ create_group: string }>(`select public.create_group($1) as create_group`, [
        "Race group",
      ])
    ).rows[0].create_group;
    await pinGroupToMinimumAttendeesConsensus(db, groupId, 1);
    await db.query(
      `insert into public.group_memberships (group_id, user_id, role) values ($1, $2, 'member')`,
      [groupId, ids.member],
    );

    const eventId = (
      await db.query<{ id: string }>(
        `insert into public.events (group_id, title, status, created_by)
         values ($1, 'Race dinner', 'proposing', $2) returning id`,
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
    await asUser(db, ids.member);
    await db.query(
      `insert into public.event_responses (candidate_id, user_id, response, visibility)
       values ($1, $2, 'yes', 'private')`,
      [candidateId, ids.member],
    );

    await asUser(db, ids.owner);
    await db.query(`select public.finalise_event($1, $2)`, [eventId, candidateId]);

    await db.exec("set role service_role");
    const again = await db.query<{ try_auto_confirm_event: boolean }>(
      `select public.try_auto_confirm_event($1) as try_auto_confirm_event`,
      [eventId],
    );
    expect(again.rows[0]?.try_auto_confirm_event).toBe(false);

    const confirmedNotes = await db.query<{ count: string }>(
      `select count(*)::text as count from public.member_notifications
       where event_id = $1 and kind = 'event_confirmed'`,
      [eventId],
    );
    expect(Number(confirmedNotes.rows[0]?.count)).toBe(1);
  });

  it("does not auto-confirm a solo organiser yes under majority rule", async () => {
    await db.query(`select set_config('hui.skip_auto_confirm', '0', false)`);
    await asUser(db, ids.owner);
    const groupId = (
      await db.query<{ create_group: string }>(`select public.create_group($1) as create_group`, [
        "Solo majority",
      ])
    ).rows[0].create_group;

    const eventId = (
      await db.query<{ id: string }>(
        `insert into public.events (group_id, title, status, created_by)
         values ($1, 'Solo', 'proposing', $2) returning id`,
        [groupId, ids.owner],
      )
    ).rows[0].id;

    const candidateId = (
      await db.query<{ id: string }>(
        `insert into public.event_candidates (event_id, group_id, starts_at, proposed_by)
         values ($1, $2, now() + interval '7 days', $3) returning id`,
        [eventId, groupId, ids.owner],
      )
    ).rows[0].id;

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
