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

let db: PGlite;

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

describe("former member roster and deletion host cleanup", () => {
  beforeAll(async () => {
    db = new PGlite();
    await db.exec(HARNESS_SQL);
    const dir = path.join(process.cwd(), "supabase", "migrations");
    const files = (await readdir(dir)).filter((file) => file.endsWith(".sql")).sort();
    for (const file of files) {
      await db.exec(await readFile(path.join(dir, file), "utf8"));
    }
    await db.query(`select set_config('hui.skip_auto_confirm', '1', false)`);
  }, 120_000);

  afterEach(async () => {
    await asUser(db, null);
  });

  afterAll(async () => {
    await db?.close();
  });

  it("lists deleted-account yes on past hui roster and display counts", async () => {
    const ownerId = await createUser(db, "fm-owner@hui.test", "FM Owner");
    const leaverId = await createUser(db, "fm-leaver@hui.test", "FM Leaver");

    await asUser(db, ownerId);
    const groupId = (
      await db.query<{ create_group: string }>(`select public.create_group($1) as create_group`, [
        "Former member roster",
      ])
    ).rows[0].create_group;
    await asUser(db, null);
    await db.query(
      `insert into public.group_memberships (group_id, user_id, role)
       values ($1, $2, 'member')`,
      [groupId, leaverId],
    );

    await asUser(db, ownerId);
    const eventId = (
      await db.query<{ id: string }>(
        `insert into public.events (group_id, title, status, created_by)
         values ($1, 'Past dinner', 'proposing', $2)
         returning id`,
        [groupId, ownerId],
      )
    ).rows[0].id;
    const candidateId = (
      await db.query<{ id: string }>(
        `insert into public.event_candidates (
           event_id, group_id, starts_at, ends_at, proposed_by
         ) values ($1, $2, now() - interval '7 days', now() - interval '6 days 22 hours', $3)
         returning id`,
        [eventId, groupId, ownerId],
      )
    ).rows[0].id;

    await db.query(
      `insert into public.event_responses (
         candidate_id, event_id, group_id, user_id, response, visibility
       ) values ($1, $2, $3, $4, 'yes', 'group')`,
      [candidateId, eventId, groupId, ownerId],
    );
    await asUser(db, leaverId);
    await db.query(
      `insert into public.event_responses (
         candidate_id, event_id, group_id, user_id, response, visibility
       ) values ($1, $2, $3, $4, 'yes', 'group')`,
      [candidateId, eventId, groupId, leaverId],
    );

    await asUser(db, ownerId);
    await db.query(`select public.finalise_event($1::uuid, $2::uuid)`, [eventId, candidateId]);
    await db.query(`select public.complete_event($1::uuid)`, [eventId]);

    await asUser(db, leaverId);
    await db.query(`select public.delete_my_account_data()`);

    await asUser(db, ownerId);
    const roster = await db.query<{ candidate_attendance_roster: { members: { display_name: string; response: string }[] } }>(
      `select public.candidate_attendance_roster($1) as candidate_attendance_roster`,
      [candidateId],
    );
    await asUser(db, null);
    const consensus = await db.query<{ candidate_consensus: { yes_count: number; accepted_count: number; passes: boolean } }>(
      `select public.candidate_consensus($1) as candidate_consensus`,
      [candidateId],
    );

    const members = roster.rows[0].candidate_attendance_roster.members;
    const former = members.find((m) => m.display_name === "Former member");
    expect(former?.response).toBe("yes");
    expect(consensus.rows[0].candidate_consensus.yes_count).toBe(2);
    expect(consensus.rows[0].candidate_consensus.accepted_count).toBe(1);
    expect(consensus.rows[0].candidate_consensus.passes).toBe(false);
  });

  it("does not let deleted responders satisfy open-hui everyone rule", async () => {
    const ownerId = await createUser(db, "fm-open-owner@hui.test", "Open Owner");
    const memberId = await createUser(db, "fm-open-member@hui.test", "Open Member");

    await asUser(db, ownerId);
    const groupId = (
      await db.query<{ create_group: string }>(`select public.create_group($1) as create_group`, [
        "Open consensus",
      ])
    ).rows[0].create_group;
    await asUser(db, null);
    await db.query(
      `insert into public.group_memberships (group_id, user_id, role)
       values ($1, $2, 'member')`,
      [groupId, memberId],
    );

    await asUser(db, ownerId);
    const eventId = (
      await db.query<{ id: string }>(
        `insert into public.events (group_id, title, status, created_by, confirm_rule)
         values ($1, 'Open brunch', 'proposing', $2, 'when_everyone_can_come')
         returning id`,
        [groupId, ownerId],
      )
    ).rows[0].id;
    const candidateId = (
      await db.query<{ id: string }>(
        `insert into public.event_candidates (
           event_id, group_id, starts_at, ends_at, proposed_by
         ) values ($1, $2, now() + interval '3 days', now() + interval '3 days 2 hours', $3)
         returning id`,
        [eventId, groupId, ownerId],
      )
    ).rows[0].id;

    await db.query(
      `insert into public.event_responses (
         candidate_id, event_id, group_id, user_id, response, visibility
       ) values ($1, $2, $3, $4, 'yes', 'group')`,
      [candidateId, eventId, groupId, ownerId],
    );

    await asUser(db, null);
    const consensus = await db.query<{ candidate_consensus: { passes: boolean; yes_count: number; eligible_member_count: number } }>(
      `select public.candidate_consensus($1) as candidate_consensus`,
      [candidateId],
    );
    const row = consensus.rows[0].candidate_consensus;
    expect(row.eligible_member_count).toBe(2);
    expect(row.yes_count).toBe(1);
    expect(row.passes).toBe(false);
  });

  it("removes upcoming host assignments but keeps past host as Former member", async () => {
    const ownerId = await createUser(db, "fm-host-owner@hui.test", "Host Owner");
    const hostLeaverId = await createUser(db, "fm-host-leaver@hui.test", "Host Leaver");

    await asUser(db, ownerId);
    const groupId = (
      await db.query<{ create_group: string }>(`select public.create_group($1) as create_group`, [
        "Host cleanup",
      ])
    ).rows[0].create_group;
    await asUser(db, null);
    await db.query(
      `insert into public.group_memberships (group_id, user_id, role)
       values ($1, $2, 'member')`,
      [groupId, hostLeaverId],
    );

    async function insertHostedEvent(title: string, status: string, startsOffset: string) {
      await asUser(db, ownerId);
      const eventId = (
        await db.query<{ id: string }>(
          `insert into public.events (
             group_id, title, status, created_by, starts_at, ends_at, creator_initial_host_user_id
           ) values (
             $1, $2, $3::public.event_status, $4,
             now() + $5::interval, now() + $5::interval + interval '2 hours',
             $6
           )
           returning id`,
          [groupId, title, status, ownerId, startsOffset, hostLeaverId],
        )
      ).rows[0].id;
      await db.query(
        `insert into public.host_assignments (
           event_id, group_id, user_id, display_name, status, assigned_by
         ) values ($1, $2, $3, 'Host Leaver', 'accepted', $4)`,
        [eventId, groupId, hostLeaverId, ownerId],
      );
      return eventId;
    }

    const pastEventId = await insertHostedEvent("Past hosted", "completed", "-7 days");
    const upcomingEventId = await insertHostedEvent("Upcoming hosted", "proposing", "5 days");

    await asUser(db, hostLeaverId);
    await db.query(`select public.delete_my_account_data()`);

    await asUser(db, null);
    const upcomingHost = await db.query(
      `select id from public.host_assignments where event_id = $1 and user_id = $2`,
      [upcomingEventId, hostLeaverId],
    );
    const pastHost = await db.query<{ display_name: string }>(
      `select display_name from public.host_assignments where event_id = $1 and user_id = $2`,
      [pastEventId, hostLeaverId],
    );
    const upcomingCreatorHost = await db.query<{ creator_initial_host_user_id: string | null }>(
      `select creator_initial_host_user_id::text from public.events where id = $1`,
      [upcomingEventId],
    );

    expect(upcomingHost.rows).toEqual([]);
    expect(pastHost.rows[0]?.display_name).toBe("Former member");
    expect(upcomingCreatorHost.rows[0]?.creator_initial_host_user_id).toBeNull();
  });
});
