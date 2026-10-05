import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { inferStandingAvailabilityHint } from "@/domain/scheduling/standing-availability";
import { wallClockToUtcIso } from "@/domain/datetime/timezone";

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

async function createGroup(database: PGlite, ownerId: string, memberId: string) {
  await asUser(database, ownerId);
  const groupId = (
    await database.query<{ create_group: string }>(`select public.create_group($1) as create_group`, [
      "Availability group",
    ])
  ).rows[0].create_group;

  await database.query(
    `insert into public.group_memberships (group_id, user_id, role)
     values ($1, $2, 'member')`,
    [groupId, memberId],
  );

  return groupId;
}

describe("HUI-025 standing availability", () => {
  beforeAll(async () => {
    db = new PGlite();
    await db.exec(HARNESS_SQL);

    const dir = path.join(process.cwd(), "supabase", "migrations");
    const files = (await readdir(dir)).filter((file) => file.endsWith(".sql")).sort();
    for (const file of files) {
      await db.exec(await readFile(path.join(dir, file), "utf8"));
    }

    ids = {
      owner: await createUser(db, "owner-025@hui.test", "Owner"),
      member: await createUser(db, "member-025@hui.test", "Member"),
      outsider: await createUser(db, "outsider-025@hui.test", "Outsider"),
    };
  }, 120_000);

  afterAll(async () => {
    await db?.close();
  });

  it("lets members manage their own windows and hides them from peers", async () => {
    const groupId = await createGroup(db, ids.owner, ids.member);

    await asUser(db, ids.member);
    await db.query(
      `insert into public.group_member_standing_availability (
         group_id, user_id, day_of_week, start_minute, end_minute, kind
       ) values ($1, $2, 5, 1020, 1320, 'usually_available')`,
      [groupId, ids.member],
    );

    const own = await db.query<{ kind: string }>(
      `select kind::text as kind from public.group_member_standing_availability
       where group_id = $1 and user_id = $2`,
      [groupId, ids.member],
    );
    expect(own.rows).toHaveLength(1);

    await asUser(db, ids.owner);
    const peer = await db.query(
      `select id from public.group_member_standing_availability where user_id = $1`,
      [ids.member],
    );
    expect(peer.rows).toHaveLength(0);

    await asUser(db, ids.outsider);
    let failed = false;
    try {
      await db.query(
        `insert into public.group_member_standing_availability (
           group_id, user_id, day_of_week, start_minute, end_minute, kind
         ) values ($1, $2, 6, 0, 1440, 'usually_unavailable')`,
        [groupId, ids.outsider],
      );
    } catch {
      failed = true;
    }
    expect(failed).toBe(true);
  });

  it("does not write event_responses when standing preferences exist", async () => {
    const groupId = await createGroup(db, ids.owner, ids.member);
    await asUser(db, ids.owner);
    const startsAt = wallClockToUtcIso("2026-10-09T18:00", "Pacific/Auckland");
    const weekdayShort = new Intl.DateTimeFormat("en-US", {
      timeZone: "Pacific/Auckland",
      weekday: "short",
    }).format(new Date(startsAt!));
    const dowByShort: Record<string, number> = {
      Sun: 0,
      Mon: 1,
      Tue: 2,
      Wed: 3,
      Thu: 4,
      Fri: 5,
      Sat: 6,
    };
    const dayOfWeek = dowByShort[weekdayShort] ?? 5;

    await asUser(db, ids.member);
    await db.query(
      `insert into public.group_member_standing_availability (
         group_id, user_id, day_of_week, start_minute, end_minute, kind
       ) values ($1, $2, $3, 0, 1440, 'usually_available')`,
      [groupId, ids.member, dayOfWeek],
    );
    const eventId = (
      await db.query<{ propose_group_event: string }>(
        `select public.propose_group_event($1, $2, null, null, null, $3::jsonb, false, null, null, null, 'dinner_meal'::public.gathering_type, null) as propose_group_event`,
        [
          groupId,
          "Friday dinner",
          JSON.stringify([{ starts_at: startsAt, ends_at: null }]),
        ],
      )
    ).rows[0].propose_group_event;

    const responses = await db.query(
      `select id from public.event_responses where event_id = $1 and user_id = $2`,
      [eventId, ids.member],
    );
    expect(responses.rows).toHaveLength(0);

    const windows = await db.query<{ id: string }>(
      `select id from public.group_member_standing_availability where user_id = $1`,
      [ids.member],
    );
    const hint = inferStandingAvailabilityHint(
      windows.rows.map((row) => ({
        id: row.id,
        groupId,
        dayOfWeek,
        startMinute: 0,
        endMinute: 1440,
        kind: "usually_available",
      })),
      startsAt!,
      null,
      "Pacific/Auckland",
    );
    expect(hint?.suggestedChoice).toBe("available");
  });

  it("keeps historical event responses when standing preference changes", async () => {
    const groupId = await createGroup(db, ids.owner, ids.member);
    await asUser(db, ids.owner);
    const startsAt = wallClockToUtcIso("2026-10-10T10:00", "Pacific/Auckland");
    const eventId = (
      await db.query<{ propose_group_event: string }>(
        `select public.propose_group_event($1, $2, null, null, null, $3::jsonb, false, null, null, null, 'dinner_meal'::public.gathering_type, null) as propose_group_event`,
        [
          groupId,
          "Saturday brunch",
          JSON.stringify([{ starts_at: startsAt, ends_at: null }]),
        ],
      )
    ).rows[0].propose_group_event;

    const candidateId = (
      await db.query<{ id: string }>(
        `select id from public.event_candidates where event_id = $1 limit 1`,
        [eventId],
      )
    ).rows[0].id;

    await asUser(db, ids.member);
    await db.query(
      `insert into public.event_responses (candidate_id, user_id, response, visibility)
       values ($1, $2, 'yes', 'group')`,
      [candidateId, ids.member],
    );

    await db.query(
      `insert into public.group_member_standing_availability (
         group_id, user_id, day_of_week, start_minute, end_minute, kind
       ) values ($1, $2, 6, 0, 1440, 'usually_unavailable')`,
      [groupId, ids.member],
    );

    const historical = await db.query<{ response: string }>(
      `select response::text as response from public.event_responses
       where candidate_id = $1 and user_id = $2`,
      [candidateId, ids.member],
    );
    expect(historical.rows[0]?.response).toBe("yes");
  });
});
