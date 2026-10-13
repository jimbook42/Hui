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

describe("proposal response deadlines", () => {
  beforeAll(async () => {
    db = new PGlite();
    await db.exec(HARNESS_SQL);
    const dir = path.join(process.cwd(), "supabase", "migrations");
    const files = (await readdir(dir)).filter((file) => file.endsWith(".sql")).sort();
    for (const file of files) {
      await db.exec(await readFile(path.join(dir, file), "utf8"));
    }
    ids = {
      owner: await createUser(db, "deadline-owner@hui.test", "Owner"),
      member: await createUser(db, "deadline-member@hui.test", "Member"),
    };
  }, 90_000);

  afterEach(async () => {
    await asUser(db, null);
  });

  afterAll(async () => {
    await db?.close();
  });

  it("sets default response deadline from group hours on insert", async () => {
    await asUser(db, ids.owner);
    const groupId = (
      await db.query<{ create_group: string }>(`select public.create_group($1) as create_group`, [
        "Deadline group",
      ])
    ).rows[0].create_group;

    await db.query(
      `update public.group_settings set proposal_deadline_hours = 24 where group_id = $1`,
      [groupId],
    );

    const row = await db.query<{ response_deadline_at: string; created_at: string }>(
      `insert into public.events (group_id, title, status, created_by)
       values ($1, 'Dinner', 'proposing', $2)
       returning response_deadline_at::text, created_at::text`,
      [groupId, ids.owner],
    );

    const deadline = new Date(row.rows[0].response_deadline_at);
    const created = new Date(row.rows[0].created_at);
    const hours = (deadline.getTime() - created.getTime()) / (60 * 60 * 1000);
    expect(hours).toBeCloseTo(24, 0);
  });

  it("marks responses after the deadline as late", async () => {
    await asUser(db, ids.owner);
    const groupId = (
      await db.query<{ create_group: string }>(`select public.create_group($1) as create_group`, [
        "Late group",
      ])
    ).rows[0].create_group;

    await db.query(
      `insert into public.group_memberships (group_id, user_id, role)
       values ($1, $2, 'member')`,
      [groupId, ids.member],
    );

    const eventId = (
      await db.query<{ id: string }>(
        `insert into public.events (group_id, title, status, created_by)
         values ($1, 'Late dinner', 'proposing', $2)
         returning id`,
        [groupId, ids.owner],
      )
    ).rows[0].id;

    await db.query(
      `update public.events
       set response_deadline_at = '2020-01-01T00:00:00Z'::timestamptz
       where id = $1`,
      [eventId],
    );

    const candidateId = (
      await db.query<{ id: string }>(
        `insert into public.event_candidates (event_id, group_id, starts_at, proposed_by)
         values ($1, $2, '2026-12-01T10:00:00Z', $3)
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

    const late = await db.query<{ submitted_late: boolean }>(
      `select submitted_late from public.event_responses where candidate_id = $1 and user_id = $2`,
      [candidateId, ids.member],
    );
    expect(late.rows[0]?.submitted_late).toBe(true);
  });

  it("queues proposal deadline reminders idempotently", async () => {
    await asUser(db, ids.owner);
    const groupId = (
      await db.query<{ create_group: string }>(`select public.create_group($1) as create_group`, [
        "Reminder group",
      ])
    ).rows[0].create_group;

    await db.query(
      `insert into public.group_memberships (group_id, user_id, role)
       values ($1, $2, 'member')`,
      [groupId, ids.member],
    );

    const eventId = (
      await db.query<{ id: string }>(
        `insert into public.events (group_id, title, status, created_by)
         values ($1, 'Reminder dinner', 'proposing', $2)
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

    await db.query(
      `update public.events
       set response_deadline_at = '2026-06-02T12:00:00Z'::timestamptz
       where id = $1`,
      [eventId],
    );

    await db.exec("set role service_role");

    const asOf = "2026-06-01T12:00:00Z";
    const first = await db.query<{ enqueue_proposal_deadline_reminders: number }>(
      `select public.enqueue_proposal_deadline_reminders($1::timestamptz) as enqueue_proposal_deadline_reminders`,
      [asOf],
    );
    expect(first.rows[0]?.enqueue_proposal_deadline_reminders).toBe(2);

    const second = await db.query<{ enqueue_proposal_deadline_reminders: number }>(
      `select public.enqueue_proposal_deadline_reminders($1::timestamptz) as enqueue_proposal_deadline_reminders`,
      [asOf],
    );
    expect(second.rows[0]?.enqueue_proposal_deadline_reminders).toBe(0);

    await asUser(db, ids.member);
    const notification = await db.query<{ kind: string; body: string }>(
      `select kind::text, body from public.member_notifications
       where user_id = $1 and event_id = $2 and kind = 'proposal_deadline_reminder'`,
      [ids.member, eventId],
    );
    expect(notification.rows).toHaveLength(1);
    expect(notification.rows[0]?.body).toContain("Reminder dinner");
    expect(notification.rows[0]?.body).toContain("Reminder group");

    await asUser(db, ids.owner);
    await db.query(
      `insert into public.event_responses (candidate_id, user_id, response, visibility)
       values ($1, $2, 'yes', 'private')`,
      [candidateId, ids.owner],
    );

    await db.exec("set role service_role");
    const third = await db.query<{ enqueue_proposal_deadline_reminders: number }>(
      `select public.enqueue_proposal_deadline_reminders($1::timestamptz) as enqueue_proposal_deadline_reminders`,
      [asOf],
    );
    expect(third.rows[0]?.enqueue_proposal_deadline_reminders).toBe(0);
  });
});
