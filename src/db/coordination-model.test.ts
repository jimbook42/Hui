import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { PGlite } from "@electric-sql/pglite";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { formatEventTimeRange, wallClockToUtcIso } from "@/domain/datetime/timezone";

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

type Ids = { owner: string; member: string; member2: string };

let db: PGlite;
let ids: Ids;
let groupId: string;

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

async function confirmEventWithWallClock(
  database: PGlite,
  createdBy: string,
  title: string,
  startsLocal: string,
  endsLocal: string,
): Promise<string> {
  await asUser(database, createdBy);
  await database.query(
    `update public.group_settings set timezone = 'Pacific/Auckland' where group_id = $1`,
    [groupId],
  );
  const startsAt = wallClockToUtcIso(startsLocal, "Pacific/Auckland");
  const endsAt = wallClockToUtcIso(endsLocal, "Pacific/Auckland");
  expect(startsAt).toBeTruthy();
  expect(endsAt).toBeTruthy();

  const event = await database.query<{ id: string }>(
    `insert into public.events (group_id, title, status, created_by)
     values ($1, $2, 'proposing', $3) returning id`,
    [groupId, title, createdBy],
  );
  const eventId = event.rows[0].id;
  const candidate = await database.query<{ id: string }>(
    `insert into public.event_candidates (event_id, starts_at, ends_at, proposed_by)
     values ($1, $2, $3, $4) returning id`,
    [eventId, startsAt, endsAt, createdBy],
  );
  await database.query(
    `insert into public.event_responses (candidate_id, user_id, response, visibility)
     values ($1, $2, 'yes', 'group')`,
    [candidate.rows[0].id, createdBy],
  );
  await database.query(`select public.finalise_event($1, $2)`, [
    eventId,
    candidate.rows[0].id,
  ]);
  return eventId;
}

describe("coordination model (HUI-022A)", () => {
  beforeAll(async () => {
    db = new PGlite();
    await db.exec(HARNESS_SQL);
    const dir = path.join(process.cwd(), "supabase", "migrations");
    const files = (await readdir(dir)).filter((file) => file.endsWith(".sql")).sort();
    for (const file of files) {
      await db.exec(await readFile(path.join(dir, file), "utf8"));
    }

    ids = {
      owner: await createUser(db, "coord-owner@hui.test", "Olivia Owner"),
      member: await createUser(db, "coord-member@hui.test", "Mia Member"),
      member2: await createUser(db, "coord-member2@hui.test", "Alex Other"),
    };

    await asUser(db, ids.owner);
    groupId = (
      await db.query<{ create_group: string }>(`select public.create_group($1) as create_group`, [
        "Coordination group",
      ])
    ).rows[0].create_group;

    await db.query(
      `insert into public.group_memberships (group_id, user_id, role) values ($1, $2, 'member'), ($1, $3, 'member')`,
      [groupId, ids.member, ids.member2],
    );
  }, 90_000);

  afterEach(async () => {
    await asUser(db, null);
  });

  afterAll(async () => {
    await db?.close();
  });

  it("requires host acceptance after coordination proposes a host", async () => {
    const eventId = await confirmEventWithWallClock(
      db,
      ids.owner,
      "Dinner",
      "2026-04-05T18:00",
      "2026-04-05T21:00",
    );

    const proposal = await db.query<{ status: string; user_id: string }>(
      `select status::text as status, user_id::text as user_id
       from public.host_assignments where event_id = $1 order by created_at desc limit 1`,
      [eventId],
    );
    expect(proposal.rows[0].status).toBe("proposed");

    await asUser(db, proposal.rows[0].user_id);
    await db.query(`select public.respond_to_host_assignment($1, true)`, [eventId]);

    const accepted = await db.query<{ status: string }>(
      `select status::text as status from public.host_assignments where event_id = $1 and status = 'accepted'`,
      [eventId],
    );
    expect(accepted.rows).toHaveLength(1);
  });

  it("keeps confirmed event wall-clock times aligned with the candidate", async () => {
    const eventId = await confirmEventWithWallClock(
      db,
      ids.owner,
      "Time check",
      "2026-04-05T18:00",
      "2026-04-05T21:00",
    );

    const rows = await db.query<{ starts_at: string; ends_at: string; timezone: string }>(
      `select starts_at::text, ends_at::text, timezone from public.events where id = $1`,
      [eventId],
    );
    const label = formatEventTimeRange(
      rows.rows[0].starts_at,
      rows.rows[0].ends_at,
      rows.rows[0].timezone,
    );
    expect(label).toContain("6:00");
    expect(label).toContain("9:00");
  });

  it("skips members who do not host", async () => {
    await asUser(db, ids.member2);
    await db.query(`select public.set_my_hosting_standing($1, 'never')`, [groupId]);

    const eventId = await confirmEventWithWallClock(
      db,
      ids.owner,
      "No Alex host",
      "2026-05-01T18:00",
      "2026-05-01T21:00",
    );

    const hosts = await db.query<{ user_id: string }>(
      `select user_id::text from public.host_assignments where event_id = $1`,
      [eventId],
    );
    expect(hosts.rows.every((row) => row.user_id !== ids.member2)).toBe(true);

    await asUser(db, ids.member2);
    await db.query(`select public.set_my_hosting_standing($1, 'default')`, [groupId]);
  });

  it("does not assign a host when hosting is disabled", async () => {
    await asUser(db, ids.owner);
    await db.query(`update public.group_settings set hosting_enabled = false where group_id = $1`, [
      groupId,
    ]);

    const eventId = await confirmEventWithWallClock(
      db,
      ids.owner,
      "No host event",
      "2026-06-01T18:00",
      "2026-06-01T21:00",
    );

    const hosts = await db.query<{ count: string }>(
      `select count(*)::text as count from public.host_assignments where event_id = $1`,
      [eventId],
    );
    expect(Number(hosts.rows[0].count)).toBe(0);

    await db.query(`update public.group_settings set hosting_enabled = true where group_id = $1`, [
      groupId,
    ]);
  });

  it("blocks regular members from updating events directly", async () => {
    const eventId = await confirmEventWithWallClock(
      db,
      ids.owner,
      "RLS dinner",
      "2026-07-01T18:00",
      "2026-07-01T21:00",
    );

    await asUser(db, ids.member);
    const denied = await db.query(
      `update public.events set title = 'Hacked' where id = $1 returning id`,
      [eventId],
    );
    expect(denied.rows).toEqual([]);
  });
});
