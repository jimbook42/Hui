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

async function createConfirmedEvent(
  database: PGlite,
  pGroupId: string,
  createdBy: string,
  title: string,
): Promise<string> {
  await asUser(database, createdBy);
  const event = await database.query<{ id: string }>(
    `insert into public.events (group_id, title, status, created_by)
     values ($1, $2, 'proposing', $3) returning id`,
    [pGroupId, title, createdBy],
  );
  const eventId = event.rows[0].id;
  const candidate = await database.query<{ id: string }>(
    `insert into public.event_candidates (event_id, starts_at, ends_at, proposed_by)
     values ($1, '2030-01-01T18:00:00Z', '2030-01-01T21:00:00Z', $2) returning id`,
    [eventId, createdBy],
  );
  const candidateId = candidate.rows[0].id;
  await database.query(
    `insert into public.event_responses (candidate_id, user_id, response, visibility)
     values ($1, $2, 'yes', 'private')`,
    [candidateId, createdBy],
  );
  await asUser(database, ids.member);
  await database.query(
    `insert into public.event_responses (candidate_id, user_id, response, visibility)
     values ($1, $2, 'yes', 'group')`,
    [candidateId, ids.member],
  );
  await asUser(database, createdBy);
  await database.query(`select public.finalise_event($1, $2)`, [eventId, candidateId]);
  return eventId;
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

describe("host coordination (HUI-020)", () => {
  beforeAll(async () => {
    db = new PGlite();
    await db.exec(HARNESS_SQL);

    const dir = path.join(process.cwd(), "supabase", "migrations");
    const files = (await readdir(dir)).filter((file) => file.endsWith(".sql")).sort();
    for (const file of files) {
      await db.exec(await readFile(path.join(dir, file), "utf8"));
    }

    ids = {
      owner: await createUser(db, "host-owner@hui.test", "Olivia Owner"),
      member: await createUser(db, "host-member@hui.test", "Mia Member"),
      outsider: await createUser(db, "host-outsider@hui.test", "Omar Outsider"),
    };

    await asUser(db, ids.owner);
    groupId = (
      await db.query<{ create_group: string }>(`select public.create_group($1) as create_group`, [
        "Host group",
      ])
    ).rows[0].create_group;

    await db.query(
      `insert into public.group_memberships (group_id, user_id, role) values ($1, $2, 'member')`,
      [groupId, ids.member],
    );
  }, 60_000);

  afterEach(async () => {
    if (db) {
      await asUser(db, null);
    }
  });

  afterAll(async () => {
    await db?.close();
  });

  it("proposes a host who must accept before hosting is final", async () => {
    const confirmedEventId = await createConfirmedEvent(db, groupId, ids.owner, "Confirmed dinner");
    await asUser(db, ids.owner);
    const assignmentId = (
      await db.query<{ assign_event_host: string }>(
        `select public.assign_event_host($1, $2) as assign_event_host`,
        [confirmedEventId, ids.member],
      )
    ).rows[0].assign_event_host;

    const row = await db.query<{ status: string; user_id: string; display_name: string }>(
      `select status::text, user_id, display_name from public.host_assignments where id = $1`,
      [assignmentId],
    );
    expect(row.rows[0]).toMatchObject({
      status: "proposed",
      user_id: ids.member,
      display_name: "Mia Member",
    });
  });

  it("accepts a proposed host assignment", async () => {
    const swapEvent = await createConfirmedEvent(db, groupId, ids.owner, "Accept dinner");

    await db.query(`select public.assign_event_host($1, $2)`, [swapEvent, ids.owner]);

    const pending = await db.query<{ status: string }>(
      `select status::text as status from public.host_assignments where event_id = $1 order by created_at desc limit 1`,
      [swapEvent],
    );
    expect(pending.rows[0].status).toBe("proposed");

    await asUser(db, ids.owner);
    await db.query(`select public.respond_to_host_assignment($1, true)`, [swapEvent]);

    const accepted = await db.query<{ status: string }>(
      `select status::text as status from public.host_assignments where event_id = $1 and status = 'accepted'`,
      [swapEvent],
    );
    expect(accepted.rows).toHaveLength(1);
  });

  it("blocks members from assigning hosts and assigning removed members", async () => {
    const confirmedEventId = await createConfirmedEvent(db, groupId, ids.owner, "Permission dinner");
    await asUser(db, ids.member);
    const denied = await expectFail(() =>
      db.query(`select public.assign_event_host($1, $2)`, [confirmedEventId, ids.owner]),
    );
    expect(denied).toMatch(/not permitted/i);

    await asUser(db, ids.owner);
    await db.query(
      `update public.group_memberships set status = 'removed' where group_id = $1 and user_id = $2`,
      [groupId, ids.member],
    );

    const removed = await expectFail(() =>
      db.query(`select public.assign_event_host($1, $2)`, [confirmedEventId, ids.member]),
    );
    expect(removed).toMatch(/active group member/i);
  });

  it("allows host assignment while proposing and rejects cancelled events", async () => {
    await asUser(db, ids.owner);
    await db.query(
      `update public.group_memberships set status = 'active' where group_id = $1 and user_id = $2`,
      [groupId, ids.member],
    );
    const proposingEvent = await db.query<{ id: string }>(
      `insert into public.events (group_id, title, status, created_by)
       values ($1, 'Still proposing', 'proposing', $2) returning id`,
      [groupId, ids.owner],
    );
    const proposingEventId = proposingEvent.rows[0].id;
    const candidate = await db.query<{ id: string }>(
      `insert into public.event_candidates (event_id, starts_at, ends_at, proposed_by)
       values ($1, '2030-02-01T18:00:00Z', '2030-02-01T21:00:00Z', $2) returning id`,
      [proposingEventId, ids.owner],
    );
    await asUser(db, ids.member);
    await db.query(
      `insert into public.event_responses (candidate_id, user_id, response, visibility)
       values ($1, $2, 'yes', 'group')`,
      [candidate.rows[0].id, ids.member],
    );
    await asUser(db, ids.owner);

    const assignmentId = (
      await db.query<{ assign_event_host: string }>(
        `select public.assign_event_host($1, $2) as assign_event_host`,
        [proposingEventId, ids.member],
      )
    ).rows[0].assign_event_host;
    expect(assignmentId).toBeTruthy();

    const cancelled = (
      await db.query<{ id: string }>(
        `insert into public.events (group_id, title, status, created_by, cancelled_at)
         values ($1, 'Cancelled dinner', 'cancelled', $2, now()) returning id`,
        [groupId, ids.owner],
      )
    ).rows[0].id;

    const cancelledError = await expectFail(() =>
      db.query(`select public.assign_event_host($1, $2)`, [cancelled, ids.owner]),
    );
    expect(cancelledError).toMatch(/cancelled/i);
  });

  it("prevents cross-group reads for outsiders", async () => {
    await asUser(db, ids.outsider);
    const rows = await db.query<{ count: string }>(
      `select count(*)::text as count from public.host_assignments where group_id = $1`,
      [groupId],
    );
    expect(Number(rows.rows[0].count)).toBe(0);
  });
});
