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

type Ids = { owner: string; member: string; member2: string; member3: string };

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

async function respondYes(database: PGlite, userId: string, candidateId: string) {
  await asUser(database, userId);
  await database.query(
    `insert into public.event_responses (candidate_id, user_id, response, visibility)
     values ($1, $2, 'yes', 'group')`,
    [candidateId, userId],
  );
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

describe("coordination lifecycle (HUI-022A.1)", () => {
  beforeAll(async () => {
    db = new PGlite();
    await db.exec(HARNESS_SQL);
    const dir = path.join(process.cwd(), "supabase", "migrations");
    const files = (await readdir(dir)).filter((file) => file.endsWith(".sql")).sort();
    for (const file of files) {
      await db.exec(await readFile(path.join(dir, file), "utf8"));
    }

    ids = {
      owner: await createUser(db, "life-owner@hui.test", "Olivia Owner"),
      member: await createUser(db, "life-member@hui.test", "Mia Member"),
      member2: await createUser(db, "life-member2@hui.test", "Alex Other"),
      member3: await createUser(db, "life-member3@hui.test", "Sam Third"),
    };

    await asUser(db, ids.owner);
    groupId = (
      await db.query<{ create_group: string }>(`select public.create_group($1) as create_group`, [
        "Lifecycle group",
      ])
    ).rows[0].create_group;

    await db.query(
      `insert into public.group_memberships (group_id, user_id, role) values ($1, $2, 'member'), ($1, $3, 'member'), ($1, $4, 'member')`,
      [groupId, ids.member, ids.member2, ids.member3],
    );
    await db.query(`update public.group_settings set timezone = 'Pacific/Auckland' where group_id = $1`, [
      groupId,
    ]);
  }, 90_000);

  afterEach(async () => {
    await asUser(db, null);
  });

  afterAll(async () => {
    await db?.close();
  });

  it("shows member attendance status in the roster without exposing private notes via RLS", async () => {
    await asUser(db, ids.owner);
    const event = await db.query<{ id: string }>(
      `insert into public.events (group_id, title, status, created_by)
       values ($1, 'Roster dinner', 'proposing', $2) returning id`,
      [groupId, ids.owner],
    );
    const candidate = await db.query<{ id: string }>(
      `insert into public.event_candidates (event_id, starts_at, ends_at, proposed_by)
       values ($1, '2026-11-10T05:00:00Z', '2026-11-10T08:00:00Z', $2) returning id`,
      [event.rows[0].id, ids.owner],
    );
    const candidateId = candidate.rows[0].id;

    await asUser(db, ids.member);
    await db.query(
      `insert into public.event_responses (candidate_id, user_id, response, visibility, note)
       values ($1, $2, 'yes', 'private', 'private note')`,
      [candidateId, ids.member],
    );

    await asUser(db, ids.owner);
    const roster = await db.query<{ candidate_attendance_roster: { members: { user_id: string; response: string | null }[] } }>(
      `select public.candidate_attendance_roster($1) as candidate_attendance_roster`,
      [candidateId],
    );
    const members = roster.rows[0].candidate_attendance_roster.members;
    const mia = members.find((m) => m.user_id === ids.member);
    expect(mia?.response).toBe("yes");

    const noteLeak = await db.query(
      `select note from public.event_responses where candidate_id = $1 and user_id = $2`,
      [candidateId, ids.member],
    );
    expect(noteLeak.rows).toEqual([]);
  });

  it("proposes a host during proposing before confirmation and requires acceptance", async () => {
    await asUser(db, ids.owner);
    const event = await db.query<{ id: string }>(
      `insert into public.events (group_id, title, status, created_by)
       values ($1, 'Pre-confirm host', 'proposing', $2) returning id`,
      [groupId, ids.owner],
    );
    const eventId = event.rows[0].id;
    const startsAt = wallClockToUtcIso("2026-05-10T18:00", "Pacific/Auckland");
    const endsAt = wallClockToUtcIso("2026-05-10T21:00", "Pacific/Auckland");
    const candidate = await db.query<{ id: string }>(
      `insert into public.event_candidates (event_id, starts_at, ends_at, proposed_by)
       values ($1, $2, $3, $4) returning id`,
      [eventId, startsAt, endsAt, ids.owner],
    );
    const candidateId = candidate.rows[0].id;

    await db.query(
      `insert into public.event_responses (candidate_id, user_id, response, visibility)
       values ($1, $2, 'yes', 'group')`,
      [candidateId, ids.owner],
    );

    const beforeConfirm = await db.query<{ status: string }>(
      `select status::text as status from public.events where id = $1`,
      [eventId],
    );
    expect(beforeConfirm.rows[0].status).toBe("proposing");

    const proposal = await db.query<{ status: string; user_id: string }>(
      `select status::text as status, user_id::text as user_id
       from public.host_assignments where event_id = $1`,
      [eventId],
    );
    expect(proposal.rows).toHaveLength(1);
    expect(proposal.rows[0].status).toBe("proposed");

    const acceptedBefore = await db.query(
      `select 1 from public.host_assignments where event_id = $1 and status = 'accepted'`,
      [eventId],
    );
    expect(acceptedBefore.rows).toHaveLength(0);

    await db.query(`select public.finalise_event($1, $2)`, [eventId, candidateId]);
    const stillProposed = await db.query<{ status: string }>(
      `select status::text as status from public.host_assignments where event_id = $1 order by created_at desc limit 1`,
      [eventId],
    );
    expect(stillProposed.rows[0].status).toBe("proposed");
  });

  it("does not propose unavailable or prefer-not members when alternatives exist", async () => {
    await asUser(db, ids.member2);
    await db.query(`select public.set_my_hosting_standing($1, 'prefer_not')`, [groupId]);
    await asUser(db, ids.member3);
    await db.query(`select public.set_my_hosting_standing($1, 'never')`, [groupId]);

    await asUser(db, ids.owner);
    const event = await db.query<{ id: string }>(
      `insert into public.events (group_id, title, status, created_by)
       values ($1, 'Host pick', 'proposing', $2) returning id`,
      [groupId, ids.owner],
    );
    const eventId = event.rows[0].id;
    const candidate = await db.query<{ id: string }>(
      `insert into public.event_candidates (event_id, starts_at, ends_at, proposed_by)
       values ($1, '2026-06-10T05:00:00Z', '2026-06-10T08:00:00Z', $2) returning id`,
      [eventId, ids.owner],
    );
    const candidateId = candidate.rows[0].id;

    await db.query(
      `insert into public.event_responses (candidate_id, user_id, response, visibility)
       values ($1, $2, 'yes', 'group')`,
      [candidateId, ids.owner],
    );
    await asUser(db, ids.member2);
    await db.query(
      `insert into public.event_responses (candidate_id, user_id, response, visibility)
       values ($1, $2, 'no', 'group')`,
      [candidateId, ids.member2],
    );
    await asUser(db, ids.member);
    await db.query(
      `insert into public.event_responses (candidate_id, user_id, response, visibility)
       values ($1, $2, 'yes', 'group')`,
      [candidateId, ids.member],
    );
    await asUser(db, ids.owner);

    const host = await db.query<{ user_id: string }>(
      `select user_id::text from public.host_assignments where event_id = $1`,
      [eventId],
    );
    expect(host.rows[0]?.user_id).not.toBe(ids.member2);
    expect(host.rows[0]?.user_id).not.toBe(ids.member3);
    expect([ids.owner, ids.member]).toContain(host.rows[0]?.user_id);

    await asUser(db, ids.member3);
    await db.query(`select public.set_my_hosting_standing($1, 'default')`, [groupId]);
    await asUser(db, ids.member2);
    await db.query(`select public.set_my_hosting_standing($1, 'default')`, [groupId]);
  });

  it("keeps Sunday lunch wall-clock PM through candidate storage and confirmation", async () => {
    await asUser(db, ids.owner);
    const startsAt = wallClockToUtcIso("2026-10-04T18:00", "Pacific/Auckland");
    const endsAt = wallClockToUtcIso("2026-10-04T21:00", "Pacific/Auckland");
    expect(startsAt).toBeTruthy();
    expect(endsAt).toBeTruthy();

    const event = await db.query<{ id: string }>(
      `insert into public.events (group_id, title, status, created_by)
       values ($1, 'Sunday lunch', 'proposing', $2) returning id`,
      [groupId, ids.owner],
    );
    const eventId = event.rows[0].id;
    const candidate = await db.query<{ id: string }>(
      `insert into public.event_candidates (event_id, starts_at, ends_at, proposed_by)
       values ($1, $2, $3, $4) returning id`,
      [eventId, startsAt, endsAt, ids.owner],
    );
    const candidateId = candidate.rows[0].id;
    await db.query(
      `insert into public.event_responses (candidate_id, user_id, response, visibility)
       values ($1, $2, 'yes', 'group')`,
      [candidateId, ids.owner],
    );
    await db.query(`select public.finalise_event($1, $2)`, [eventId, candidateId]);

    const rows = await db.query<{ starts_at: string; ends_at: string; timezone: string }>(
      `select starts_at::text, ends_at::text, timezone from public.events where id = $1`,
      [eventId],
    );
    const label = formatEventTimeRange(
      rows.rows[0].starts_at,
      rows.rows[0].ends_at,
      rows.rows[0].timezone,
    );
    expect(label.toLowerCase()).toContain("pm");
    expect(label).toContain("6:00");
    expect(label).toContain("9:00");
  });

  it("lets the first-event creator nominate a host as a proposal only", async () => {
    await asUser(db, ids.owner);
    const freshGroup = (
      await db.query<{ create_group: string }>(`select public.create_group($1) as create_group`, [
        "First event group",
      ])
    ).rows[0].create_group;
    await db.query(`insert into public.group_memberships (group_id, user_id, role) values ($1, $2, 'member')`, [
      freshGroup,
      ids.member,
    ]);

    const event = await db.query<{ id: string }>(
      `insert into public.events (group_id, title, status, created_by)
       values ($1, 'First dinner', 'proposing', $2) returning id`,
      [freshGroup, ids.owner],
    );
    const eventId = event.rows[0].id;

    const assignmentId = (
      await db.query<{ propose_creator_initial_host_for_event: string }>(
        `select public.propose_creator_initial_host_for_event($1, $2) as propose_creator_initial_host_for_event`,
        [eventId, ids.member],
      )
    ).rows[0].propose_creator_initial_host_for_event;

    expect(assignmentId).toBeTruthy();
    const row = await db.query<{ status: string; user_id: string }>(
      `select status::text as status, user_id::text as user_id from public.host_assignments where id = $1`,
      [assignmentId],
    );
    expect(row.rows[0]).toMatchObject({ status: "proposed", user_id: ids.member });

    const accepted = await db.query(
      `select 1 from public.host_assignments where event_id = $1 and status = 'accepted'`,
      [eventId],
    );
    expect(accepted.rows).toHaveLength(0);
  });

  it("records no host when the first-event creator opts out", async () => {
    await asUser(db, ids.owner);
    const freshGroup = (
      await db.query<{ create_group: string }>(`select public.create_group($1) as create_group`, [
        "No host group",
      ])
    ).rows[0].create_group;

    const event = await db.query<{ id: string }>(
      `insert into public.events (group_id, title, status, created_by)
       values ($1, 'No host dinner', 'proposing', $2) returning id`,
      [freshGroup, ids.owner],
    );
    const eventId = event.rows[0].id;
    const candidate = await db.query<{ id: string }>(
      `insert into public.event_candidates (event_id, starts_at, ends_at, proposed_by)
       values ($1, '2032-01-01T05:00:00Z', '2032-01-01T08:00:00Z', $2) returning id`,
      [eventId, ids.owner],
    );

    await db.query(`select public.propose_creator_initial_host_for_event($1, null)`, [eventId]);
    await db.query(
      `insert into public.event_responses (candidate_id, user_id, response, visibility)
       values ($1, $2, 'yes', 'group')`,
      [candidate.rows[0].id, ids.owner],
    );

    const hosts = await db.query(
      `select 1 from public.host_assignments where event_id = $1`,
      [eventId],
    );
    expect(hosts.rows).toHaveLength(0);
  });

  it("falls back to normal selection when the first-event host declines", async () => {
    await asUser(db, ids.owner);
    const freshGroup = (
      await db.query<{ create_group: string }>(`select public.create_group($1) as create_group`, [
        "Decline group",
      ])
    ).rows[0].create_group;
    await db.query(
      `insert into public.group_memberships (group_id, user_id, role) values ($1, $2, 'member'), ($1, $3, 'member')`,
      [freshGroup, ids.member, ids.member2],
    );

    const event = await db.query<{ id: string }>(
      `insert into public.events (group_id, title, status, created_by)
       values ($1, 'Decline host', 'proposing', $2) returning id`,
      [freshGroup, ids.owner],
    );
    const eventId = event.rows[0].id;
    const candidate = await db.query<{ id: string }>(
      `insert into public.event_candidates (event_id, starts_at, ends_at, proposed_by)
       values ($1, '2032-02-01T05:00:00Z', '2032-02-01T08:00:00Z', $2) returning id`,
      [eventId, ids.owner],
    );

    await db.query(`select public.propose_creator_initial_host_for_event($1, $2)`, [
      eventId,
      ids.member,
    ]);
    await respondYes(db, ids.owner, candidate.rows[0].id);
    await respondYes(db, ids.member2, candidate.rows[0].id);

    await asUser(db, ids.member);
    await db.query(`select public.respond_to_host_assignment($1, false)`, [eventId]);

    const next = await db.query<{ user_id: string; status: string }>(
      `select user_id::text, status::text as status
       from public.host_assignments
       where event_id = $1 and status = 'proposed'
       order by created_at desc limit 1`,
      [eventId],
    );
    expect(next.rows[0]?.status).toBe("proposed");
    expect(next.rows[0]?.user_id).not.toBe(ids.member);
  });

  it("keeps November Sunday evening wall-clock in Pacific/Auckland", async () => {
    const startsAt = wallClockToUtcIso("2026-11-08T18:00", "Pacific/Auckland");
    const endsAt = wallClockToUtcIso("2026-11-08T21:00", "Pacific/Auckland");
    const label = formatEventTimeRange(startsAt!, endsAt!, "Pacific/Auckland");
    expect(label.toLowerCase()).toContain("pm");
    expect(label).toContain("6:00");
    expect(label).toContain("9:00");
  });
});
