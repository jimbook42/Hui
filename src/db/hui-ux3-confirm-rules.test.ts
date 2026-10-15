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

type Ids = { owner: string; member: string; third: string };

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

describe("HUI-UX3 per-hui confirm rules and host Yes gate", () => {
  beforeAll(async () => {
    db = new PGlite();
    await db.exec(HARNESS_SQL);
    const dir = path.join(process.cwd(), "supabase", "migrations");
    const files = (await readdir(dir)).filter((file) => file.endsWith(".sql")).sort();
    for (const file of files) {
      await db.exec(await readFile(path.join(dir, file), "utf8"));
    }
    ids = {
      owner: await createUser(db, "ux3-owner@hui.test", "Owner"),
      member: await createUser(db, "ux3-member@hui.test", "Member"),
      third: await createUser(db, "ux3-third@hui.test", "Third"),
    };
  }, 120_000);

  afterEach(async () => {
    await asUser(db, null);
  });

  afterAll(async () => {
    await db?.close();
  });

  async function seedGroup(memberIds: string[] = [ids.member]) {
    await asUser(db, ids.owner);
    const groupId = (
      await db.query<{ create_group: string }>(`select public.create_group($1) as create_group`, [
        "UX3 group",
      ])
    ).rows[0].create_group;
    for (const memberId of memberIds) {
      await db.query(
        `insert into public.group_memberships (group_id, user_id, role)
         values ($1, $2, 'member')`,
        [groupId, memberId],
      );
    }
    await db.query(
      `update public.group_settings
       set minimum_attendees = 1, consensus_rule = 'majority_active_members'
       where group_id = $1`,
      [groupId],
    );
    return groupId;
  }

  async function seedEvent(
    groupId: string,
    confirmRule: "when_most_can_come" | "when_everyone_can_come" | "organiser_picks",
  ) {
    const eventId = (
      await db.query<{ id: string }>(
        `insert into public.events (group_id, title, status, created_by, confirm_rule)
         values ($1, 'UX3 dinner', 'proposing', $2, $3::public.event_confirm_rule)
         returning id`,
        [groupId, ids.owner, confirmRule],
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
    return { eventId, candidateId };
  }

  async function sayYes(userId: string, candidateId: string, eventId: string) {
    await asUser(db, userId);
    await db.query(
      `insert into public.event_responses (event_id, candidate_id, user_id, response, visibility)
       values ($1, $2, $3, 'yes', 'private')
       on conflict (candidate_id, user_id) do update set response = 'yes'`,
      [eventId, candidateId, userId],
    );
  }

  it("defaults existing-style events to when_most_can_come", async () => {
    const groupId = await seedGroup();
    const { eventId } = await seedEvent(groupId, "when_most_can_come");
    const row = await db.query<{ confirm_rule: string }>(
      `select confirm_rule::text from public.events where id = $1`,
      [eventId],
    );
    expect(row.rows[0]?.confirm_rule).toBe("when_most_can_come");
  });

  it("auto-confirms on majority when two members say Yes", async () => {
    const groupId = await seedGroup();
    const { eventId, candidateId } = await seedEvent(groupId, "when_most_can_come");
    await sayYes(ids.owner, candidateId, eventId);
    await sayYes(ids.member, candidateId, eventId);
    const status = await db.query<{ status: string }>(
      `select status::text from public.events where id = $1`,
      [eventId],
    );
    expect(status.rows[0]?.status).toBe("confirmed");
  });

  it("requires every active member for when_everyone_can_come", async () => {
    const groupId = await seedGroup([ids.member, ids.third]);
    const { eventId, candidateId } = await seedEvent(groupId, "when_everyone_can_come");
    await sayYes(ids.owner, candidateId, eventId);
    await sayYes(ids.member, candidateId, eventId);
    let status = await db.query<{ status: string }>(
      `select status::text from public.events where id = $1`,
      [eventId],
    );
    expect(status.rows[0]?.status).toBe("proposing");
    await sayYes(ids.third, candidateId, eventId);
    status = await db.query<{ status: string }>(
      `select status::text from public.events where id = $1`,
      [eventId],
    );
    expect(status.rows[0]?.status).toBe("confirmed");
  });

  it("never auto-confirms when organiser_picks", async () => {
    const groupId = await seedGroup();
    const { eventId, candidateId } = await seedEvent(groupId, "organiser_picks");
    await sayYes(ids.owner, candidateId, eventId);
    await sayYes(ids.member, candidateId, eventId);
    const status = await db.query<{ status: string }>(
      `select status::text from public.events where id = $1`,
      [eventId],
    );
    expect(status.rows[0]?.status).toBe("proposing");
  });

  it("allows manual finalise for organiser_picks when at least one Yes", async () => {
    const groupId = await seedGroup();
    const { eventId, candidateId } = await seedEvent(groupId, "organiser_picks");
    await sayYes(ids.owner, candidateId, eventId);
    await asUser(db, ids.owner);
    await db.query(`select public.finalise_event($1, $2, false)`, [eventId, candidateId]);
    const status = await db.query<{ status: string }>(
      `select status::text from public.events where id = $1`,
      [eventId],
    );
    expect(status.rows[0]?.status).toBe("confirmed");
  });

  it("blocks confirm when accepted host has not said Yes", async () => {
    const groupId = await seedGroup([ids.member, ids.third]);
    const { eventId, candidateId } = await seedEvent(groupId, "when_most_can_come");
    await asUser(db, ids.owner);
    await db.query(
      `insert into public.host_assignments (event_id, group_id, user_id, status, display_name, assigned_by)
       values ($1, $2, $3, 'accepted', 'Member', $4)`,
      [eventId, groupId, ids.member, ids.owner],
    );
    await sayYes(ids.owner, candidateId, eventId);
    await sayYes(ids.third, candidateId, eventId);
    await asUser(db, ids.owner);
    const summary = await db.query<{ event_consensus_summary: { candidates: Array<{ failure_reason: string; passes: boolean }> } }>(
      `select public.event_consensus_summary($1) as event_consensus_summary`,
      [eventId],
    );
    const candidate = summary.rows[0]?.event_consensus_summary.candidates[0];
    expect(candidate?.failure_reason).toBe("waiting_on_host");
    expect(candidate?.passes).toBe(false);
    const status = await db.query<{ status: string }>(
      `select status::text from public.events where id = $1`,
      [eventId],
    );
    expect(status.rows[0]?.status).toBe("proposing");
  });

  it("blocks force finalise when host has not said Yes", async () => {
    const groupId = await seedGroup();
    const { eventId, candidateId } = await seedEvent(groupId, "when_most_can_come");
    await asUser(db, ids.owner);
    await db.query(
      `insert into public.host_assignments (event_id, group_id, user_id, status, display_name, assigned_by)
       values ($1, $2, $3, 'accepted', 'Member', $4)`,
      [eventId, groupId, ids.member, ids.owner],
    );
    await sayYes(ids.owner, candidateId, eventId);
    await asUser(db, ids.owner);
    await expect(
      db.query(`select public.finalise_event($1, $2, true)`, [eventId, candidateId]),
    ).rejects.toThrow(/host/i);
  });

  it("assign_event_host requires Yes on the time", async () => {
    const groupId = await seedGroup();
    const { eventId, candidateId } = await seedEvent(groupId, "when_most_can_come");
    await asUser(db, ids.owner);
    await expect(
      db.query(`select public.assign_event_host($1, $2)`, [eventId, ids.member]),
    ).rejects.toThrow(/yes/i);
    await sayYes(ids.member, candidateId, eventId);
    await asUser(db, ids.owner);
    const assignment = await db.query<{ assign_event_host: string }>(
      `select public.assign_event_host($1, $2) as assign_event_host`,
      [eventId, ids.member],
    );
    expect(assignment.rows[0]?.assign_event_host).toBeTruthy();
  });

  it("pick_host_candidate only returns members who said Yes", async () => {
    const groupId = await seedGroup();
    const { eventId, candidateId } = await seedEvent(groupId, "when_most_can_come");
    await asUser(db, ids.member);
    await db.query(
      `insert into public.event_responses (event_id, candidate_id, user_id, response, visibility)
       values ($1, $2, $3, 'maybe', 'private')`,
      [eventId, candidateId, ids.member],
    );
    await sayYes(ids.owner, candidateId, eventId);
    const pick = await db.query<{ pick_host_candidate: string | null }>(
      `select public.pick_host_candidate($1, $2) as pick_host_candidate`,
      [groupId, eventId],
    );
    expect(pick.rows[0]?.pick_host_candidate).toBe(ids.owner);
  });
});
