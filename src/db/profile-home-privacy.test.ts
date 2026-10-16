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
  leaver: string;
};

let db: PGlite;
let ids: Ids;

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

describe("profile home location privacy (HUI-UX5 G1)", () => {
  beforeAll(async () => {
    db = new PGlite();
    await db.exec(HARNESS_SQL);

    const dir = path.join(process.cwd(), "supabase", "migrations");
    const files = (await readdir(dir)).filter((file) => file.endsWith(".sql")).sort();
    for (const file of files) {
      await db.exec(await readFile(path.join(dir, file), "utf8"));
    }
    await db.query(`select set_config('hui.skip_auto_confirm', '1', false)`);

    ids = {
      owner: await createUser(db, "home-owner@hui.test", "Home Owner"),
      member: await createUser(db, "home-member@hui.test", "Home Member"),
      leaver: await createUser(db, "home-leaver@hui.test", "Home Leaver"),
    };

    await asUser(db, ids.owner);
    const groupId = (
      await db.query<{ create_group: string }>(
        `select public.create_group($1) as create_group`,
        ["Home privacy"],
      )
    ).rows[0].create_group;
    await asUser(db, null);
    await db.query(
      `insert into public.group_memberships (group_id, user_id, role)
       values ($1, $2, 'member')`,
      [groupId, ids.member],
    );

    await asUser(db, ids.owner);
    await db.query(
      `update public.profiles
       set home_location_label = $2,
           home_location_lat = -36.8485,
           home_location_lng = 174.7633
       where id = $1`,
      [ids.owner, "1 Queen St"],
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

  it("does not grant authenticated SELECT on home location columns", async () => {
    await asUser(db, null);
    const privilege = await db.query<{ allowed: boolean }>(
      `select has_column_privilege('authenticated', 'public.profiles', 'home_location_label', 'SELECT') as allowed`,
    );
    expect(privilege.rows[0].allowed).toBe(false);
  });

  it("lets the owner read their home via my_home_location", async () => {
    await asUser(db, ids.owner);
    const rows = await db.query<{
      home_location_label: string;
      home_location_lat: number;
      home_location_lng: number;
    }>(`select * from public.my_home_location()`);

    expect(rows.rows[0]).toMatchObject({
      home_location_label: "1 Queen St",
      home_location_lat: -36.8485,
      home_location_lng: 174.7633,
    });
  });

  it("lets the owner update home label without coordinates and read back via my_home_location", async () => {
    await asUser(db, ids.owner);
    await db.query(
      `update public.profiles
       set home_location_label = $2,
           home_location_lat = null,
           home_location_lng = null
       where id = $1`,
      [ids.owner, "3 Queen Street"],
    );

    const rows = await db.query<{ home_location_label: string }>(
      `select home_location_label from public.my_home_location()`,
    );
    expect(rows.rows[0]?.home_location_label).toBe("3 Queen Street");

    await db.query(
      `update public.profiles
       set home_location_label = $2,
           home_location_lat = -36.8485,
           home_location_lng = 174.7633
       where id = $1`,
      [ids.owner, "1 Queen St"],
    );
  });

  it("returns host home only to the host with group membership (not co-members)", async () => {
    await asUser(db, ids.owner);
    const groupId = (
      await db.query<{ id: string }>(
        `select id from public.groups order by created_at desc limit 1`,
      )
    ).rows[0].id;

    const hostRows = await db.query<{ home_location_label: string }>(
      `select home_location_label from public.co_member_host_home_location($1, $2)`,
      [ids.owner, groupId],
    );
    expect(hostRows.rows[0]?.home_location_label).toBe("1 Queen St");

    await asUser(db, ids.member);
    const memberPeek = await db.query(
      `select home_location_label from public.co_member_host_home_location($1, $2)`,
      [ids.owner, groupId],
    );
    expect(memberPeek.rows).toEqual([]);
  });
});

describe("account deletion home + responses (HUI-UX5 G2–G3)", () => {
  beforeAll(async () => {
    db = new PGlite();
    await db.exec(HARNESS_SQL);

    const dir = path.join(process.cwd(), "supabase", "migrations");
    const files = (await readdir(dir)).filter((file) => file.endsWith(".sql")).sort();
    for (const file of files) {
      await db.exec(await readFile(path.join(dir, file), "utf8"));
    }
    await db.query(`select set_config('hui.skip_auto_confirm', '1', false)`);

    ids = {
      owner: await createUser(db, "del-owner@hui.test", "Del Owner"),
      member: await createUser(db, "del-member@hui.test", "Del Member"),
      leaver: await createUser(db, "del-leaver@hui.test", "Del Leaver"),
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

  it("clears home location, standing availability, responses, and renames denormalised copies", async () => {
    await asUser(db, ids.owner);
    const groupId = (
      await db.query<{ create_group: string }>(
        `select public.create_group($1) as create_group`,
        ["Deletion privacy"],
      )
    ).rows[0].create_group;
    await asUser(db, null);
    await db.query(
      `insert into public.group_memberships (group_id, user_id, role)
       values ($1, $2, 'member')`,
      [groupId, ids.leaver],
    );

    await asUser(db, ids.leaver);
    await db.query(
      `update public.profiles
       set home_location_label = 'Hidden St',
           home_location_lat = -41.0,
           home_location_lng = 174.0
       where id = $1`,
      [ids.leaver],
    );
    await db.query(
      `insert into public.group_member_standing_availability (
         group_id, user_id, day_of_week, start_minute, end_minute, kind
       ) values ($1, $2, 6, 0, 1440, 'usually_available')`,
      [groupId, ids.leaver],
    );

    await asUser(db, ids.owner);
    const event = await db.query<{ id: string }>(
      `insert into public.events (group_id, title, status, created_by)
       values ($1, 'Potluck', 'proposing', $2)
       returning id`,
      [groupId, ids.owner],
    );
    const eventId = event.rows[0].id;
    const candidate = await db.query<{ id: string }>(
      `insert into public.event_candidates (
         event_id, group_id, starts_at, ends_at, proposed_by
       ) values ($1, $2, now() + interval '1 day', now() + interval '1 day 2 hours', $3)
       returning id`,
      [eventId, groupId, ids.owner],
    );
    const candidateId = candidate.rows[0].id;

    await asUser(db, ids.leaver);
    await db.query(
      `insert into public.event_responses (
         candidate_id, event_id, group_id, user_id, response, visibility, note
       ) values ($1, $2, $3, $4, 'yes', 'group', 'private note')`,
      [candidateId, eventId, groupId, ids.leaver],
    );

    await asUser(db, ids.owner);
    await db.query(
      `insert into public.event_contributions (
         event_id, group_id, label, user_id, display_name, status, assigned_by
       ) values ($1, $2, 'Dessert', $3, 'Del Leaver', 'accepted', $4)`,
      [eventId, groupId, ids.leaver, ids.owner],
    );
    await db.query(
      `insert into public.host_assignments (
         event_id, group_id, user_id, display_name, status, assigned_by
       ) values ($1, $2, $3, 'Del Leaver', 'accepted', $4)`,
      [eventId, groupId, ids.leaver, ids.owner],
    );

    await asUser(db, ids.leaver);
    await db.query(`select public.delete_my_account_data()`);

    await asUser(db, null);
    const profile = await db.query<{
      home_location_label: string | null;
      display_name: string;
    }>(
      `select home_location_label, display_name
       from public.profiles where id = $1`,
      [ids.leaver],
    );
    const standing = await db.query(
      `select id from public.group_member_standing_availability where user_id = $1`,
      [ids.leaver],
    );
    const responses = await db.query(
      `select id from public.event_responses where user_id = $1`,
      [ids.leaver],
    );
    const contribution = await db.query<{ display_name: string }>(
      `select display_name from public.event_contributions where user_id = $1`,
      [ids.leaver],
    );
    const host = await db.query<{ display_name: string }>(
      `select display_name from public.host_assignments where user_id = $1`,
      [ids.leaver],
    );

    expect(profile.rows[0].display_name).toBe("Former member");
    expect(profile.rows[0].home_location_label).toBeNull();
    expect(standing.rows).toEqual([]);
    expect(responses.rows).toEqual([]);
    expect(contribution.rows[0]?.display_name).toBe("Former member");
    expect(host.rows[0]?.display_name).toBe("Former member");
  });
});
