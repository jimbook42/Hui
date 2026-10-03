import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { PGlite } from "@electric-sql/pglite";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

/**
 * Applies supabase/migrations against an in-process Postgres and checks RLS.
 * Docker is not required. Roles and auth.uid() match the Supabase contracts
 * the migrations already call.
 */

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

async function countAsOwner(
  database: PGlite,
  sql: string,
  params: unknown[],
): Promise<number> {
  await asUser(database, null);
  const result = await database.query<{ n: number }>(sql, params);
  return Number(result.rows[0].n);
}

describe("foundation schema and RLS", () => {
  beforeAll(async () => {
    db = new PGlite();
    await db.exec(HARNESS_SQL);

    const dir = path.join(process.cwd(), "supabase", "migrations");
    const files = (await readdir(dir)).filter((file) => file.endsWith(".sql")).sort();
    expect(files.length).toBeGreaterThan(0);
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

  it("keeps the development seed free of inserted rows", async () => {
    const seed = await readFile(path.join(process.cwd(), "supabase", "seed.sql"), "utf8");
    expect(seed.toLowerCase()).not.toContain("insert into");
  });

  it("enables and forces RLS on every public table", async () => {
    await asUser(db, null);
    const missing = await db.query<{ relname: string }>(
      `select c.relname
       from pg_class c
       join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public'
         and c.relkind = 'r'
         and (c.relrowsecurity = false or c.relforcerowsecurity = false)
       order by c.relname`,
    );
    expect(missing.rows).toEqual([]);
  });

  it("stores one-off and recurring gatherings in the same event table", async () => {
    const groupId = await createGroup(db, ids, "Cadence");
    await asUser(db, ids.member);

    const series = await db.query<{ id: string }>(
      `insert into public.recurrence_series
         (group_id, title, interval_unit, interval_count, starts_on, created_by)
       values ($1, 'Monthly dinner', 'month', 1, '2026-11-01', $2)
       returning id`,
      [groupId, ids.member],
    );
    const recurring = await db.query<{ recurrence_series_id: string | null }>(
      `insert into public.events (group_id, recurrence_series_id, title, created_by)
       values ($1, $2, 'November dinner', $3)
       returning recurrence_series_id`,
      [groupId, series.rows[0].id, ids.member],
    );
    const oneOff = await db.query<{ recurrence_series_id: string | null }>(
      `insert into public.events (group_id, title, created_by)
       values ($1, 'Picnic', $2)
       returning recurrence_series_id`,
      [groupId, ids.member],
    );

    expect(recurring.rows[0].recurrence_series_id).toBe(series.rows[0].id);
    expect(oneOff.rows[0].recurrence_series_id).toBeNull();
  });

  it("lets a member read group data they are allowed to see", async () => {
    const groupId = await createGroup(db, ids, "Whanau");
    await asUser(db, ids.member);

    const event = await db.query<{ id: string }>(
      `insert into public.events (group_id, title, created_by)
       values ($1, 'Sunday dinner', $2)
       returning id`,
      [groupId, ids.member],
    );
    const eventId = event.rows[0].id;
    const candidate = await db.query<{ id: string }>(
      `insert into public.event_candidates (event_id, starts_at, ends_at, proposed_by)
       values ($1, '2026-11-02T06:00:00Z', '2026-11-02T09:00:00Z', $2)
       returning id`,
      [eventId, ids.member],
    );
    const candidateId = candidate.rows[0].id;

    await db.query(
      `insert into public.event_responses (candidate_id, user_id, response, visibility)
       values ($1, $2, 'no', 'private')`,
      [candidateId, ids.member],
    );

    await asUser(db, ids.owner);
    await db.query(
      `insert into public.event_responses (candidate_id, user_id, response, visibility)
       values ($1, $2, 'yes', 'group')`,
      [candidateId, ids.owner],
    );

    await asUser(db, ids.member);
    const shared = await db.query<{ id: string }>(
      `insert into public.dietary_entries (user_id, category, label)
       values ($1, 'allergy', 'peanuts')
       returning id`,
      [ids.member],
    );
    await db.query(
      `insert into public.dietary_entry_shares (dietary_entry_id, group_id)
       values ($1, $2)`,
      [shared.rows[0].id, groupId],
    );
    const unshared = await db.query<{ id: string }>(
      `insert into public.dietary_entries (user_id, category, label)
       values ($1, 'dislike', 'coriander')
       returning id`,
      [ids.member],
    );

    await asUser(db, ids.admin);
    const groups = await db.query<{ name: string }>(
      `select name from public.groups where id = $1`,
      [groupId],
    );
    const events = await db.query<{ title: string }>(
      `select title from public.events where id = $1`,
      [eventId],
    );
    const names = await db.query<{ display_name: string }>(
      `select display_name from public.profiles where id = $1`,
      [ids.member],
    );
    const sharedVisible = await db.query(
      `select id from public.dietary_entries where id = $1`,
      [shared.rows[0].id],
    );
    const unsharedVisible = await db.query(
      `select id from public.dietary_entries where id = $1`,
      [unshared.rows[0].id],
    );
    const responses = await db.query<{ candidate_attendance_roster: { members: { response: string | null }[] } }>(
      `select public.candidate_attendance_roster($1) as candidate_attendance_roster`,
      [candidateId],
    );
    const settings = await db.query<{ maybe_responses_enabled: boolean }>(
      `select maybe_responses_enabled from public.group_settings where group_id = $1`,
      [groupId],
    );

    expect(groups.rows.map((row) => row.name)).toEqual(["Whanau"]);
    expect(events.rows.map((row) => row.title)).toEqual(["Sunday dinner"]);
    expect(names.rows.map((row) => row.display_name)).toEqual(["Mia Member"]);
    expect(sharedVisible.rows).toHaveLength(1);
    expect(unsharedVisible.rows).toEqual([]);
    const rosterResponses = responses.rows[0].candidate_attendance_roster.members
      .map((m) => m.response)
      .filter((r): r is string => r !== null)
      .sort();
    expect(rosterResponses).toEqual(["no", "yes"]);
    expect(settings.rows[0].maybe_responses_enabled).toBe(true);
  });

  it("hides a group's private data from a non-member", async () => {
    const groupId = await createGroup(db, ids, "Private circle");
    await asUser(db, ids.owner);
    const event = await db.query<{ id: string }>(
      `insert into public.events (group_id, title, created_by)
       values ($1, 'Secret dinner', $2)
       returning id`,
      [groupId, ids.owner],
    );
    await asUser(db, ids.member);
    const entry = await db.query<{ id: string }>(
      `insert into public.dietary_entries (user_id, category, label)
       values ($1, 'requirement', 'gluten-free')
       returning id`,
      [ids.member],
    );
    await db.query(
      `insert into public.dietary_entry_shares (dietary_entry_id, group_id)
       values ($1, $2)`,
      [entry.rows[0].id, groupId],
    );

    await asUser(db, ids.outsider);
    const groups = await db.query(`select id from public.groups where id = $1`, [groupId]);
    const events = await db.query(`select id from public.events where group_id = $1`, [
      groupId,
    ]);
    const dietary = await db.query(
      `select id from public.dietary_entries where id = $1`,
      [entry.rows[0].id],
    );
    const profiles = await db.query(`select id from public.profiles where id = $1`, [
      ids.member,
    ]);
    const memberships = await db.query(
      `select id from public.group_memberships where group_id = $1`,
      [groupId],
    );
    const insertError = await expectFail(() =>
      db.query(
        `insert into public.events (group_id, title, created_by) values ($1, 'Intrusion', $2)`,
        [groupId, ids.outsider],
      ),
    );

    expect(groups.rows).toEqual([]);
    expect(events.rows).toEqual([]);
    expect(dietary.rows).toEqual([]);
    expect(profiles.rows).toEqual([]);
    expect(memberships.rows).toEqual([]);
    expect(insertError.toLowerCase()).toMatch(/row-level security|permission denied/);

    await asUser(db, null);
    await db.exec("set role anon");
    const anonError = await expectFail(() =>
      db.query(`select id from public.groups where id = $1`, [groupId]),
    );
    expect(anonError.toLowerCase()).toMatch(/permission denied|row-level security/);
    expect(event.rows[0].id).toBeTruthy();
  });

  it("stops a member from changing another member's private rows", async () => {
    const groupId = await createGroup(db, ids, "Boundaries");
    await asUser(db, ids.owner);
    const entry = await db.query<{ id: string }>(
      `insert into public.dietary_entries (user_id, category, label)
       values ($1, 'preference', 'spicy')
       returning id`,
      [ids.owner],
    );
    await db.query(
      `insert into public.dietary_entry_shares (dietary_entry_id, group_id)
       values ($1, $2)`,
      [entry.rows[0].id, groupId],
    );
    const event = await db.query<{ id: string }>(
      `insert into public.events (group_id, title, created_by)
       values ($1, 'Lunch', $2)
       returning id`,
      [groupId, ids.owner],
    );
    const candidate = await db.query<{ id: string }>(
      `insert into public.event_candidates (event_id, starts_at, ends_at, proposed_by)
       values ($1, '2026-11-03T00:00:00Z', '2026-11-03T02:00:00Z', $2)
       returning id`,
      [event.rows[0].id, ids.owner],
    );
    await db.query(
      `insert into public.event_responses (candidate_id, user_id, response, visibility)
       values ($1, $2, 'yes', 'private')`,
      [candidate.rows[0].id, ids.owner],
    );
    await db.query(
      `insert into public.host_assignments (event_id, user_id, assigned_by)
       values ($1, $2, $2)`,
      [event.rows[0].id, ids.owner],
    );

    await asUser(db, ids.member);
    const dietaryUpdate = await db.query(
      `update public.dietary_entries set label = 'hacked' where id = $1 returning id`,
      [entry.rows[0].id],
    );
    const profileUpdate = await db.query(
      `update public.profiles set display_name = 'Hacked' where id = $1 returning id`,
      [ids.owner],
    );
    const responseUpdate = await db.query(
      `update public.event_responses
       set response = 'no'
       where candidate_id = $1 and user_id = $2
       returning id`,
      [candidate.rows[0].id, ids.owner],
    );
    const hostUpdate = await db.query(
      `update public.host_assignments
       set status = 'declined'
       where event_id = $1 and user_id = $2
       returning id`,
      [event.rows[0].id, ids.owner],
    );

    expect(dietaryUpdate.rows).toEqual([]);
    expect(profileUpdate.rows).toEqual([]);
    expect(responseUpdate.rows).toEqual([]);
    expect(hostUpdate.rows).toEqual([]);

    await asUser(db, null);
    const dietary = await db.query<{ label: string }>(
      `select label from public.dietary_entries where id = $1`,
      [entry.rows[0].id],
    );
    const profile = await db.query<{ display_name: string }>(
      `select display_name from public.profiles where id = $1`,
      [ids.owner],
    );
    const response = await db.query<{ response: string; status: string }>(
      `select r.response::text as response, h.status::text as status
       from public.event_responses r
       join public.host_assignments h on h.event_id = r.event_id
       where r.user_id = $1 and r.candidate_id = $2`,
      [ids.owner, candidate.rows[0].id],
    );
    expect(dietary.rows[0].label).toBe("spicy");
    expect(profile.rows[0].display_name).toBe("Olivia Owner");
    expect(response.rows[0]).toMatchObject({ response: "yes", status: "proposed" });
  });

  it("preserves gathering rows after removal and blocks the removed member", async () => {
    const groupId = await createGroup(db, ids, "History");
    const leaver = await createUser(db, "leaver@hui.test", "Lea Leaver");
    await asUser(db, ids.owner);
    await db.query(
      `insert into public.group_memberships (group_id, user_id, role)
       values ($1, $2, 'member')`,
      [groupId, leaver],
    );

    await asUser(db, leaver);
    const event = await db.query<{ id: string }>(
      `insert into public.events (group_id, title, created_by)
       values ($1, 'Kept dinner', $2)
       returning id`,
      [groupId, leaver],
    );
    const eventId = event.rows[0].id;
    const candidate = await db.query<{ id: string }>(
      `insert into public.event_candidates (event_id, starts_at, ends_at, proposed_by)
       values ($1, '2026-12-01T06:00:00Z', '2026-12-01T09:00:00Z', $2)
       returning id`,
      [eventId, leaver],
    );
    await db.query(
      `insert into public.event_responses (candidate_id, user_id, response)
       values ($1, $2, 'yes')`,
      [candidate.rows[0].id, leaver],
    );
    await db.query(
      `insert into public.host_assignments (event_id, user_id, assigned_by)
       values ($1, $2, $2)`,
      [eventId, leaver],
    );
    await db.query(`update public.profiles set display_name = 'Lea Renamed' where id = $1`, [
      leaver,
    ]);

    await asUser(db, ids.owner);
    const memory = await db.query<{ id: string }>(
      `insert into public.event_memories (event_id, notes, recorded_by)
       values ($1, 'Lovely night', $2)
       returning id`,
      [eventId, ids.owner],
    );
    await db.query(
      `insert into public.event_memory_attendees (memory_id, user_id, display_name)
       values ($1, $2, 'placeholder')`,
      [memory.rows[0].id, leaver],
    );

    await asUser(db, ids.admin);
    const removed = await db.query<{ status: string }>(
      `update public.group_memberships
       set status = 'removed'
       where group_id = $1 and user_id = $2
       returning status::text as status`,
      [groupId, leaver],
    );
    expect(removed.rows[0].status).toBe("removed");

    await asUser(db, leaver);
    const ownMembership = await db.query<{ status: string }>(
      `select status::text as status
       from public.group_memberships
       where group_id = $1`,
      [groupId],
    );
    const hiddenEvents = await db.query(`select id from public.events where id = $1`, [
      eventId,
    ]);
    const hiddenGroups = await db.query(`select id from public.groups where id = $1`, [
      groupId,
    ]);
    expect(ownMembership.rows).toEqual([{ status: "removed" }]);
    expect(hiddenEvents.rows).toEqual([]);
    expect(hiddenGroups.rows).toEqual([]);

    await asUser(db, ids.owner);
    const visible = await db.query<{ title: string; display_name: string }>(
      `select e.title, a.display_name
       from public.events e
       join public.event_memories m on m.event_id = e.id
       join public.event_memory_attendees a on a.memory_id = m.id
       where e.id = $1`,
      [eventId],
    );
    const host = await db.query<{ display_name: string }>(
      `select display_name from public.host_assignments where event_id = $1`,
      [eventId],
    );
    expect(visible.rows).toEqual([{ title: "Kept dinner", display_name: "Lea Renamed" }]);
    expect(host.rows[0].display_name).toBe("Lea Leaver");

    expect(
      await countAsOwner(
        db,
        `select count(*)::int as n from public.event_responses where event_id = $1`,
        [eventId],
      ),
    ).toBe(1);
    expect(
      await countAsOwner(
        db,
        `select count(*)::int as n
         from public.group_memberships
         where group_id = $1 and user_id = $2 and status = 'removed'`,
        [groupId, leaver],
      ),
    ).toBe(1);
    expect(
      await countAsOwner(
        db,
        `select count(*)::int as n
         from public.group_memberships
         where group_id = $1 and user_id = $2 and status = 'active'`,
        [groupId, ids.member],
      ),
    ).toBe(1);
  });

  it("restricts settings, membership, and ownership to admins and the owner", async () => {
    const groupId = await createGroup(db, ids, "Rules");

    await asUser(db, ids.member);
    const hiddenAudit = await db.query(
      `select id from public.membership_changes where group_id = $1`,
      [groupId],
    );
    expect(hiddenAudit.rows).toEqual([]);
    const memberSettings = await db.query(
      `update public.group_settings
       set minimum_attendees = 4
       where group_id = $1
       returning group_id`,
      [groupId],
    );
    const memberInsert = await expectFail(() =>
      db.query(
        `insert into public.group_memberships (group_id, user_id, role)
         values ($1, $2, 'member')`,
        [groupId, ids.outsider],
      ),
    );
    const memberTransfer = await expectFail(() =>
      db.query(`select public.transfer_group_ownership($1, $2)`, [groupId, ids.member]),
    );
    expect(memberSettings.rows).toEqual([]);
    expect(memberInsert.toLowerCase()).toMatch(/row-level security|permission denied/);
    expect(memberTransfer).toMatch(/only the owner can transfer ownership/);

    await asUser(db, ids.admin);
    const adminSettings = await db.query<{ minimum_attendees: number }>(
      `update public.group_settings
       set minimum_attendees = 3,
           who_may_propose = 'admins_only',
           maybe_responses_enabled = false
       where group_id = $1
       returning minimum_attendees`,
      [groupId],
    );
    const joiner = await createUser(db, "joiner@hui.test", "Jo Joiner");
    await asUser(db, ids.admin);
    const added = await db.query<{ role: string }>(
      `insert into public.group_memberships (group_id, user_id, role)
       values ($1, $2, 'member')
       returning role::text as role`,
      [groupId, joiner],
    );
    const removeOwner = await expectFail(() =>
      db.query(
        `update public.group_memberships
         set status = 'removed'
         where group_id = $1 and user_id = $2`,
        [groupId, ids.owner],
      ),
    );
    const adminTransfer = await expectFail(() =>
      db.query(`select public.transfer_group_ownership($1, $2)`, [groupId, ids.admin]),
    );

    const adminAudit = await db.query(
      `select id from public.membership_changes where group_id = $1`,
      [groupId],
    );
    expect(adminAudit.rows.length).toBeGreaterThan(0);
    expect(adminSettings.rows[0].minimum_attendees).toBe(3);
    expect(added.rows[0].role).toBe("member");
    expect(removeOwner).toMatch(/only ownership transfer can change the owner membership/);
    expect(adminTransfer).toMatch(/only the owner can transfer ownership/);

    await asUser(db, ids.member);
    const blockedEvent = await expectFail(() =>
      db.query(
        `insert into public.events (group_id, title, created_by) values ($1, 'Nope', $2)`,
        [groupId, ids.member],
      ),
    );
    expect(blockedEvent.toLowerCase()).toMatch(/row-level security|permission denied/);

    await asUser(db, ids.admin);
    const adminEvent = await db.query<{ id: string }>(
      `insert into public.events (group_id, title, created_by)
       values ($1, 'Admin plan', $2)
       returning id`,
      [groupId, ids.admin],
    );
    const candidate = await db.query<{ id: string }>(
      `insert into public.event_candidates (event_id, starts_at, ends_at, proposed_by)
       values ($1, '2026-11-08T06:00:00Z', '2026-11-08T08:00:00Z', $2)
       returning id`,
      [adminEvent.rows[0].id, ids.admin],
    );
    await asUser(db, ids.member);
    const maybe = await expectFail(() =>
      db.query(
        `insert into public.event_responses (candidate_id, user_id, response)
         values ($1, $2, 'maybe')`,
        [candidate.rows[0].id, ids.member],
      ),
    );
    const yes = await db.query(
      `insert into public.event_responses (candidate_id, user_id, response)
       values ($1, $2, 'yes')
       returning id`,
      [candidate.rows[0].id, ids.member],
    );
    expect(maybe).toMatch(/maybe responses are disabled/);
    expect(yes.rows).toHaveLength(1);

    await asUser(db, ids.owner);
    await db.query(`select public.transfer_group_ownership($1, $2)`, [groupId, ids.admin]);

    await asUser(db, null);
    const owners = await db.query<{ user_id: string; owner_id: string }>(
      `select m.user_id, g.owner_id
       from public.group_memberships m
       join public.groups g on g.id = m.group_id
       where m.group_id = $1 and m.role = 'owner' and m.status = 'active'`,
      [groupId],
    );
    expect(owners.rows).toEqual([{ user_id: ids.admin, owner_id: ids.admin }]);

    await asUser(db, ids.owner);
    const formerOwner = await expectFail(() =>
      db.query(`select public.transfer_group_ownership($1, $2)`, [groupId, ids.owner]),
    );
    expect(formerOwner).toMatch(/only the owner can transfer ownership/);
  });
});
