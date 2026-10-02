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

type Ids = {
  owner: string;
  member: string;
  outsider: string;
};

let db: PGlite;
let ids: Ids;
let groupId: string;

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

async function asUser(database: PGlite, userId: string | null) {
  await database.exec("reset role");
  await database.query(`select set_config('request.jwt.claim.sub', $1, false)`, [
    userId ?? "",
  ]);
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

describe("member notifications (HUI-021)", () => {
  beforeAll(async () => {
    db = new PGlite();
    await db.exec(HARNESS_SQL);

    const dir = path.join(process.cwd(), "supabase", "migrations");
    const files = (await readdir(dir)).filter((file) => file.endsWith(".sql")).sort();
    for (const file of files) {
      await db.exec(await readFile(path.join(dir, file), "utf8"));
    }

    ids = {
      owner: await createUser(db, "notify-owner@hui.test", "Nora Owner"),
      member: await createUser(db, "notify-member@hui.test", "Ned Member"),
      outsider: await createUser(db, "notify-outsider@hui.test", "Nina Outsider"),
    };

    await asUser(db, ids.owner);
    groupId = (
      await db.query<{ create_group: string }>(`select public.create_group($1) as create_group`, [
        "Notify group",
      ])
    ).rows[0].create_group;

    await db.query(
      `insert into public.group_memberships (group_id, user_id, role) values ($1, $2, 'member')`,
      [groupId, ids.member],
    );
  }, 90_000);

  afterEach(async () => {
    if (db) {
      await asUser(db, null);
    }
  });

  afterAll(async () => {
    await db?.close();
  });

  it("notifies other members when an event is proposed, not the proposer", async () => {
    await asUser(db, ids.owner);
    const event = await db.query<{ id: string }>(
      `insert into public.events (group_id, title, status, created_by)
       values ($1, 'Potluck', 'proposing', $2) returning id`,
      [groupId, ids.owner],
    );
    const eventId = event.rows[0].id;

    await asUser(db, ids.member);
    const memberRows = await db.query<{ kind: string; event_id: string }>(
      `select kind::text, event_id from public.member_notifications where user_id = $1`,
      [ids.member],
    );
    expect(memberRows.rows).toHaveLength(1);
    expect(memberRows.rows[0]).toMatchObject({
      kind: "event_proposed",
      event_id: eventId,
    });

    await asUser(db, ids.owner);
    const ownerRows = await db.query(
      `select 1 from public.member_notifications where user_id = $1 and event_id = $2`,
      [ids.owner, eventId],
    );
    expect(ownerRows.rows).toHaveLength(0);
  });

  it("dedupes identical notification keys", async () => {
    await asUser(db, null);
    const first = await db.query<{ queue_member_notification: string }>(
      `select public.queue_member_notification($1, 'event_proposed', 'T', 'B', $2, null, 'dedupe:test') as queue_member_notification`,
      [ids.member, groupId],
    );
    const second = await db.query<{ queue_member_notification: string | null }>(
      `select public.queue_member_notification($1, 'event_proposed', 'T', 'B', $2, null, 'dedupe:test') as queue_member_notification`,
      [ids.member, groupId],
    );
    expect(first.rows[0].queue_member_notification).toBeTruthy();
    expect(second.rows[0].queue_member_notification).toBeNull();
  });

  it("enforces notification RLS and blocks client inserts", async () => {
    await asUser(db, ids.member);
    const denied = await expectFail(() =>
      db.query(
        `insert into public.member_notifications (user_id, kind, title, body, group_id, dedupe_key)
         values ($1, 'event_proposed', 'x', 'y', $2, 'bad:1')`,
        [ids.member, groupId],
      ),
    );
    expect(denied).toMatch(/permission denied|violates row-level security/i);

    await asUser(db, ids.outsider);
    const rows = await db.query(
      `select id from public.member_notifications where user_id = $1`,
      [ids.member],
    );
    expect(rows.rows).toHaveLength(0);
  });

  it("marks read only for the notification owner", async () => {
    await asUser(db, null);
    const note = await db.query<{ id: string }>(
      `select public.queue_member_notification($1, 'reconnect_reminder', 'T', 'B', $2, null, 'read:test') as id`,
      [ids.member, groupId],
    );
    const notificationId = note.rows[0].id;

    await asUser(db, ids.member);
    await db.query(`select public.mark_notification_read($1)`, [notificationId]);
    const readRow = await db.query<{ read_at: string | null }>(
      `select read_at from public.member_notifications where id = $1`,
      [notificationId],
    );
    expect(readRow.rows[0].read_at).not.toBeNull();

    await asUser(db, ids.owner);
    const denied = await expectFail(() =>
      db.query(`select public.mark_notification_read($1)`, [notificationId]),
    );
    expect(denied).toMatch(/notification not found/i);
  });

  it("skips reconnect reminders when the member opts out", async () => {
    await asUser(db, ids.member);
    await db.query(
      `update public.profiles set member_reconnect_reminders_enabled = false where id = $1`,
      [ids.member],
    );
    await db.query(
      `update public.group_settings
       set reconnect_reminders_enabled = true, reconnect_after_days = 1
       where group_id = $1`,
      [groupId],
    );
    await db.query(
      `update public.events set updated_at = now() - interval '10 days' where group_id = $1`,
      [groupId],
    );

    const created = await db.query<{ sync_reconnect_reminders_for_member: number }>(
      `select public.sync_reconnect_reminders_for_member() as sync_reconnect_reminders_for_member`,
    );
    expect(created.rows[0].sync_reconnect_reminders_for_member).toBe(0);
  });
});
