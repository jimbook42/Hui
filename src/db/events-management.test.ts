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
  admin: string;
  member: string;
  outsider: string;
};

let db: PGlite;
let ids: Ids;

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

async function createGroup(database: PGlite, people: Ids, name: string) {
  await asUser(database, people.owner);
  const created = await database.query<{ id: string }>(
    `insert into public.groups (name, owner_id) values ($1, $2) returning id`,
    [name, people.owner],
  );
  const groupId = created.rows[0].id;
  await database.query(
    `insert into public.group_memberships (group_id, user_id, role)
     values ($1, $2, 'owner')`,
    [groupId, people.owner],
  );
  await database.query(
    `insert into public.group_memberships (group_id, user_id, role)
     values ($1, $2, 'admin')`,
    [groupId, people.admin],
  );
  await database.query(
    `insert into public.group_memberships (group_id, user_id, role)
     values ($1, $2, 'member')`,
    [groupId, people.member],
  );
  return groupId;
}

describe("event management (HUI-008)", () => {
  beforeAll(async () => {
    db = new PGlite();
    await db.exec(HARNESS_SQL);

    const dir = path.join(process.cwd(), "supabase", "migrations");
    const files = (await readdir(dir)).filter((file) => file.endsWith(".sql")).sort();
    for (const file of files) {
      await db.exec(await readFile(path.join(dir, file), "utf8"));
    }

    ids = {
      owner: await createUser(db, "owner@hui.test", "Olivia Owner"),
      admin: await createUser(db, "admin@hui.test", "Alex Admin"),
      member: await createUser(db, "member@hui.test", "Mia Member"),
      outsider: await createUser(db, "outsider@hui.test", "Omar Outsider"),
    };
  }, 60_000);

  afterEach(async () => {
    if (db) {
      await asUser(db, null);
    }
  });

  afterAll(async () => {
    await db?.close();
  });

  it("creates a one-off event with proposing status and creator", async () => {
    const groupId = await createGroup(db, ids, "One-offs");
    await asUser(db, ids.member);
    const created = await db.query<{ status: string; created_by: string }>(
      `insert into public.events (group_id, title, status, created_by)
       values ($1, 'BBQ', 'proposing', $2)
       returning status::text as status, created_by`,
      [groupId, ids.member],
    );
    expect(created.rows[0]).toEqual({
      status: "proposing",
      created_by: ids.member,
    });
  });

  it("links recurring events to a series in the same group", async () => {
    const groupId = await createGroup(db, ids, "Recurring");
    await asUser(db, ids.member);
    const series = await db.query<{ id: string }>(
      `insert into public.recurrence_series
         (group_id, title, interval_unit, interval_count, starts_on, created_by)
       values ($1, 'Monthly lunch', 'month', 1, '2026-11-01', $2)
       returning id`,
      [groupId, ids.member],
    );
    const event = await db.query<{ recurrence_series_id: string }>(
      `insert into public.events (group_id, recurrence_series_id, title, created_by)
       values ($1, $2, 'November lunch', $3)
       returning recurrence_series_id`,
      [groupId, series.rows[0].id, ids.member],
    );
    expect(event.rows[0].recurrence_series_id).toBe(series.rows[0].id);
  });

  it("rejects a series from another group on the same event", async () => {
    const groupA = await createGroup(db, ids, "Group A");
    const groupB = await createGroup(db, ids, "Group B");
    await asUser(db, ids.member);
    const series = await db.query<{ id: string }>(
      `insert into public.recurrence_series
         (group_id, title, interval_unit, interval_count, starts_on, created_by)
       values ($1, 'Other cadence', 'week', 1, '2026-11-01', $2)
       returning id`,
      [groupA, ids.member],
    );
    const error = await expectFail(() =>
      db.query(
        `insert into public.events (group_id, recurrence_series_id, title, created_by)
         values ($1, $2, 'Mismatch', $3)`,
        [groupB, series.rows[0].id, ids.member],
      ),
    );
    expect(error.toLowerCase()).toMatch(/foreign key|violates/);
  });

  it("blocks outsiders and removed members from reading events", async () => {
    const groupId = await createGroup(db, ids, "Private events");
    await asUser(db, ids.member);
    const event = await db.query<{ id: string }>(
      `insert into public.events (group_id, title, created_by)
       values ($1, 'Secret', $2)
       returning id`,
      [groupId, ids.member],
    );

    await asUser(db, ids.outsider);
    const outsiderRead = await db.query(`select id from public.events where id = $1`, [
      event.rows[0].id,
    ]);
    expect(outsiderRead.rows).toEqual([]);

    await asUser(db, ids.member);
    await db.query(`select public.leave_group($1)`, [groupId]);
    const removedRead = await db.query(`select id from public.events where id = $1`, [
      event.rows[0].id,
    ]);
    expect(removedRead.rows).toEqual([]);
  });

  it("enforces proposal settings for inserts", async () => {
    const groupId = await createGroup(db, ids, "Proposal rules");
    await asUser(db, ids.admin);
    await db.query(
      `update public.group_settings
       set who_may_propose = 'admins_only', one_off_events_allowed = false
       where group_id = $1`,
      [groupId],
    );

    await asUser(db, ids.member);
    const memberBlocked = await expectFail(() =>
      db.query(
        `insert into public.events (group_id, title, created_by)
         values ($1, 'Nope', $2)`,
        [groupId, ids.member],
      ),
    );
    expect(memberBlocked.toLowerCase()).toMatch(/row-level security|permission denied/);

    await asUser(db, ids.admin);
    const oneOffBlocked = await expectFail(() =>
      db.query(
        `insert into public.events (group_id, title, created_by)
         values ($1, 'Still no', $2)`,
        [groupId, ids.admin],
      ),
    );
    expect(oneOffBlocked.toLowerCase()).toMatch(/row-level security|permission denied/);
  });

  it("prevents changing immutable event fields and cancelling via status hack", async () => {
    const groupId = await createGroup(db, ids, "Lifecycle");
    await asUser(db, ids.member);
    const event = await db.query<{ id: string }>(
      `insert into public.events (group_id, title, status, created_by)
       values ($1, 'Editable', 'proposing', $2)
       returning id`,
      [groupId, ids.member],
    );
    const eventId = event.rows[0].id;

    await asUser(db, ids.member);
    const cancelled = await db.query<{ status: string }>(
      `update public.events
       set status = 'cancelled', cancelled_at = now()
       where id = $1
       returning status::text as status`,
      [eventId],
    );
    expect(cancelled.rows[0].status).toBe("cancelled");

    const immutable = await expectFail(() =>
      db.query(
        `update public.events set created_by = $2 where id = $1`,
        [eventId, ids.admin],
      ),
    );
    expect(immutable).toMatch(/immutable/);

    await asUser(db, ids.outsider);
    const outsiderUpdate = await db.query(
      `update public.events set title = 'Hacked' where id = $1 returning id`,
      [eventId],
    );
    expect(outsiderUpdate.rows).toEqual([]);
  });
});
