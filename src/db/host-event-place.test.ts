import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

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

type Ids = { owner: string; host: string; member: string };

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

function message(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

async function expectFail(run: () => Promise<unknown>): Promise<string> {
  try {
    await run();
  } catch (error) {
    return message(error);
  }
  throw new Error("expected failure");
}

describe("update_event_place (HUI-026U.4)", () => {
  beforeAll(async () => {
    db = new PGlite();
    await db.exec(HARNESS_SQL);
    const dir = path.join(process.cwd(), "supabase", "migrations");
    const files = (await readdir(dir)).filter((file) => file.endsWith(".sql")).sort();
    for (const file of files) {
      await db.exec(await readFile(path.join(dir, file), "utf8"));
    }

    ids = {
      owner: await createUser(db, "place-owner@hui.test", "Place Owner"),
      host: await createUser(db, "place-host@hui.test", "Place Host"),
      member: await createUser(db, "place-member@hui.test", "Place Member"),
    };

    await asUser(db, ids.owner);
    groupId = (
      await db.query<{ create_group: string }>(`select public.create_group($1) as create_group`, [
        "Place Group",
      ])
    ).rows[0].create_group;

    await db.query(`insert into public.group_memberships (group_id, user_id, role) values ($1, $2, 'member')`, [
      groupId,
      ids.host,
    ]);
    await db.query(`insert into public.group_memberships (group_id, user_id, role) values ($1, $2, 'member')`, [
      groupId,
      ids.member,
    ]);
  }, 60_000);

  afterAll(async () => {
    await db.close();
  });

  async function createProposingEvent(title: string): Promise<{ eventId: string; candidateId: string }> {
    await asUser(db, ids.owner);
    const eventId = (
      await db.query<{ id: string }>(
        `insert into public.events (group_id, title, status, location, created_by)
         values ($1, $2, 'proposing', 'Old park', $3) returning id`,
        [groupId, title, ids.owner],
      )
    ).rows[0].id;
    const candidateId = (
      await db.query<{ id: string }>(
        `insert into public.event_candidates (event_id, group_id, starts_at, ends_at, proposed_by)
         values ($1, $2, '2032-09-10T05:00:00Z', '2032-09-10T08:00:00Z', $3) returning id`,
        [eventId, groupId, ids.owner],
      )
    ).rows[0].id;
    return { eventId, candidateId };
  }

  async function respondYes(userId: string, candidateId: string) {
    await asUser(db, userId);
    await db.query(
      `insert into public.event_responses (candidate_id, user_id, response, visibility)
       values ($1, $2, 'yes', 'group')
       on conflict (candidate_id, user_id) do update set response = excluded.response`,
      [candidateId, userId],
    );
  }

  async function acceptHostForEvent(eventId: string, candidateId: string) {
    await respondYes(ids.host, candidateId);
    await asUser(db, ids.host);
    await db.query(`select public.respond_to_host_assignment($1, true)`, [eventId]);
  }

  it("lets the accepted host change place via RPC but not via direct update", async () => {
    const { eventId, candidateId } = await createProposingEvent("Hosted hui");
    await acceptHostForEvent(eventId, candidateId);

    await asUser(db, ids.host);
    const blocked = await db.query(
      `update public.events set location = 'Blocked' where id = $1 returning id`,
      [eventId],
    );
    expect(blocked.rows).toEqual([]);

    await db.query(`select public.update_event_place($1, $2, $3, $4)`, [
      eventId,
      "New community hall",
      -36.8485,
      174.7633,
    ]);

    const row = await db.query<{
      location: string | null;
      location_lat: number | null;
      location_lng: number | null;
    }>(`select location, location_lat, location_lng from public.events where id = $1`, [eventId]);
    expect(row.rows[0]).toMatchObject({
      location: "New community hall",
      location_lat: -36.8485,
      location_lng: 174.7633,
    });
  });

  it("requires a place when accepting hosting on a place-required event", async () => {
    const { eventId, candidateId } = await createProposingEvent("Place on accept");
    await asUser(db, ids.owner);
    await db.query(`update public.events set host_place_required = true where id = $1`, [eventId]);
    await respondYes(ids.host, candidateId);

    await asUser(db, ids.host);
    const missingPlace = await expectFail(async () => {
      await db.query(`select public.respond_to_host_assignment($1, true)`, [eventId]);
    });
    expect(missingPlace).toMatch(/confirm where|place/i);

    await db.query(`select public.respond_to_host_assignment($1, true, $2, $3, $4)`, [
      eventId,
      "Host home",
      -43.5321,
      172.6362,
    ]);

    const row = await db.query<{ location: string | null; status: string }>(
      `select e.location, ha.status::text as status
       from public.events e
       join public.host_assignments ha on ha.event_id = e.id and ha.user_id = $2
       where e.id = $1`,
      [eventId, ids.host],
    );
    expect(row.rows[0]).toMatchObject({ location: "Host home", status: "accepted" });
  });

  it("rejects proposed-only hosts and ordinary members", async () => {
    const { eventId, candidateId } = await createProposingEvent("Pending host");
    await respondYes(ids.host, candidateId);

    await asUser(db, ids.host);
    const proposedErr = await expectFail(async () => {
      await db.query(`select public.update_event_place($1, $2, null, null)`, [eventId, "Sneak place"]);
    });
    expect(proposedErr).toMatch(/accepted host/i);

    await asUser(db, ids.member);
    const memberErr = await expectFail(async () => {
      await db.query(`select public.update_event_place($1, $2, null, null)`, [eventId, "Sneak place"]);
    });
    expect(memberErr).toMatch(/accepted host/i);
  });
});
