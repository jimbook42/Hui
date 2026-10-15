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

async function asAnon(database: PGlite) {
  await database.exec("reset role");
  await database.query(`select set_config('request.jwt.claim.sub', '', false)`);
  await database.exec("set role anon");
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

async function expectNoExecute(
  database: PGlite,
  sql: string,
  params: unknown[] = [],
) {
  await expect(database.query(sql, params)).rejects.toThrow(/permission denied/i);
}

describe("HUI-UX3 helper EXECUTE grants", () => {
  beforeAll(async () => {
    db = new PGlite();
    await db.exec(HARNESS_SQL);
    const dir = path.join(process.cwd(), "supabase", "migrations");
    const files = (await readdir(dir)).filter((file) => file.endsWith(".sql")).sort();
    for (const file of files) {
      await db.exec(await readFile(path.join(dir, file), "utf8"));
    }
    ids = {
      owner: await createUser(db, "ux3-grants-owner@hui.test", "Owner"),
      member: await createUser(db, "ux3-grants-member@hui.test", "Member"),
    };
  }, 120_000);

  afterEach(async () => {
    await asUser(db, null);
  });

  afterAll(async () => {
    await db?.close();
  });

  async function seedGroup() {
    await asUser(db, ids.owner);
    const groupId = (
      await db.query<{ create_group: string }>(`select public.create_group($1) as create_group`, [
        "Grants group",
      ])
    ).rows[0].create_group;
    await db.query(
      `insert into public.group_memberships (group_id, user_id, role)
       values ($1, $2, 'member')`,
      [groupId, ids.member],
    );
    await db.query(
      `update public.group_settings
       set minimum_attendees = 1, consensus_rule = 'majority_active_members'
       where group_id = $1`,
      [groupId],
    );
    return groupId;
  }

  async function seedEvent(groupId: string) {
    const eventId = (
      await db.query<{ id: string }>(
        `insert into public.events (group_id, title, status, created_by, confirm_rule)
         values ($1, 'Grants dinner', 'proposing', $2, 'when_most_can_come')
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

  it("anon cannot execute the three internal helpers", async () => {
    const groupId = await seedGroup();
    const { eventId, candidateId } = await seedEvent(groupId);
    await sayYes(ids.member, candidateId, eventId);
    await asAnon(db);
    await expectNoExecute(
      db,
      `select public.member_has_yes_for_hosting($1::uuid, $2::uuid)`,
      [ids.member, eventId],
    );
    await expectNoExecute(db, `select public.host_yes_required_for_candidate($1::uuid, $2::uuid)`, [
      eventId,
      candidateId,
    ]);
    await expectNoExecute(db, `select public.event_accepted_host_user_id($1::uuid)`, [eventId]);
  });

  it("authenticated cannot call host_yes_required or event_accepted_host_user_id directly", async () => {
    const groupId = await seedGroup();
    const { eventId, candidateId } = await seedEvent(groupId);
    await asUser(db, ids.owner);
    await expectNoExecute(db, `select public.host_yes_required_for_candidate($1::uuid, $2::uuid)`, [
      eventId,
      candidateId,
    ]);
    await expectNoExecute(db, `select public.event_accepted_host_user_id($1::uuid)`, [eventId]);
  });

  it("authenticated flows still work after helper grant tightening", async () => {
    const groupId = await seedGroup();
    await asUser(db, ids.owner);
    const candidates = JSON.stringify([{ starts_at: "2026-12-15T18:00:00Z", ends_at: null }]);
    const proposedEventId = (
      await db.query<{ propose_group_event: string }>(
        `select public.propose_group_event(
          p_group_id := $1::uuid,
          p_title := $2::text,
          p_location := null::text,
          p_notes := null::text,
          p_recurrence := null::jsonb,
          p_candidates := $3::jsonb,
          p_set_initial_host := false,
          p_initial_host_user_id := null::uuid,
          p_location_lat := null::double precision,
          p_location_lng := null::double precision,
          p_gathering_type := 'dinner_meal'::public.gathering_type,
          p_gathering_type_custom := null::text,
          p_requested_contributions := '[]'::jsonb,
          p_organiser_commits_host := false
        ) as propose_group_event`,
        [groupId, "Proposed via RPC", candidates],
      )
    ).rows[0].propose_group_event;
    expect(proposedEventId).toBeTruthy();

    const { eventId, candidateId } = await seedEvent(groupId);
    await sayYes(ids.owner, candidateId, eventId);
    await sayYes(ids.member, candidateId, eventId);

    const autoConfirmed = await db.query<{ status: string }>(
      `select status::text from public.events where id = $1`,
      [eventId],
    );
    expect(autoConfirmed.rows[0]?.status).toBe("confirmed");

    await db.query(`select set_config('hui.skip_auto_confirm', '1', false)`);
    await asUser(db, ids.owner);
    const { eventId: manualEventId, candidateId: manualCandidateId } = await seedEvent(groupId);
    await sayYes(ids.owner, manualCandidateId, manualEventId);
    await sayYes(ids.member, manualCandidateId, manualEventId);
    await asUser(db, ids.owner);
    await db.query(`select public.finalise_event($1::uuid, $2::uuid, false)`, [
      manualEventId,
      manualCandidateId,
    ]);
    const manualStatus = await db.query<{ status: string }>(
      `select status::text from public.events where id = $1`,
      [manualEventId],
    );
    expect(manualStatus.rows[0]?.status).toBe("confirmed");

    await asUser(db, ids.owner);
    const { eventId: hostEventId, candidateId: hostCandidateId } = await seedEvent(groupId);
    await sayYes(ids.member, hostCandidateId, hostEventId);
    await asUser(db, ids.owner);
    const assignment = await db.query<{ assign_event_host: string }>(
      `select public.assign_event_host($1, $2) as assign_event_host`,
      [hostEventId, ids.member],
    );
    expect(assignment.rows[0]?.assign_event_host).toBeTruthy();

    await asUser(db, ids.member);
    await db.query(`select public.respond_to_host_assignment($1, true)`, [hostEventId]);
    const accepted = await db.query(
      `select 1 from public.host_assignments where event_id = $1 and status = 'accepted'`,
      [hostEventId],
    );
    expect(accepted.rows).toHaveLength(1);

    const invokerPath = await db.query<{ proposed_host_remains_eligible: boolean }>(
      `select public.proposed_host_remains_eligible($1::uuid, $2::uuid) as proposed_host_remains_eligible`,
      [hostEventId, ids.member],
    );
    expect(invokerPath.rows[0]?.proposed_host_remains_eligible).toBe(true);
  });
});
