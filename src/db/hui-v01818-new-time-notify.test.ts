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
select set_config('hui.allow_past_event_candidates', 'on', false);
`;

type Ids = { owner: string; member: string; other: string };

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

describe("v0.18.18 new proposed time notifications", () => {
  beforeAll(async () => {
    db = new PGlite();
    await db.exec(HARNESS_SQL);
    const dir = path.join(process.cwd(), "supabase", "migrations");
    const files = (await readdir(dir)).filter((file) => file.endsWith(".sql")).sort();
    for (const file of files) {
      await db.exec(await readFile(path.join(dir, file), "utf8"));
    }
    ids = {
      owner: await createUser(db, "owner-v01818@test", "Owner"),
      member: await createUser(db, "member-v01818@test", "Member"),
      other: await createUser(db, "other-v01818@test", "Other"),
    };
  }, 180_000);

  afterEach(async () => {
    await asUser(db, null);
  });

  afterAll(async () => {
    await db?.close();
  });

  async function seedOpenHui() {
    await asUser(db, ids.owner);
    const groupId = (
      await db.query<{ create_group: string }>(`select public.create_group($1) as create_group`, [
        "v01818 group",
      ])
    ).rows[0].create_group;
    await db.query(
      `insert into public.group_memberships (group_id, user_id, role)
       values ($1, $2, 'member'), ($1, $3, 'member')`,
      [groupId, ids.member, ids.other],
    );
    const eventId = (
      await db.query<{ id: string }>(
        `insert into public.events (group_id, title, status, created_by, confirm_rule)
         values ($1, 'Potluck', 'proposing', $2, 'when_most_can_come')
         returning id`,
        [groupId, ids.owner],
      )
    ).rows[0].id;
    const firstCandidate = (
      await db.query<{ id: string }>(
        `insert into public.event_candidates (event_id, group_id, starts_at, proposed_by)
         values ($1, $2, '2026-12-01T10:00:00Z', $3)
         returning id`,
        [eventId, groupId, ids.owner],
      )
    ).rows[0].id;
    return { groupId, eventId, firstCandidate };
  }

  it("notifies members who already answered, not the organiser or non-responders", async () => {
    const { groupId, eventId, firstCandidate } = await seedOpenHui();

    await asUser(db, ids.member);
    await db.query(
      `insert into public.event_responses (event_id, candidate_id, user_id, response, visibility)
       values ($1, $2, $3, 'yes', 'private')`,
      [eventId, firstCandidate, ids.member],
    );

    await asUser(db, ids.owner);
    await db.query(
      `insert into public.event_candidates (event_id, group_id, starts_at, proposed_by)
       values ($1, $2, '2026-12-02T10:00:00Z', $3)`,
      [eventId, groupId, ids.owner],
    );

    await asUser(db, null);
    await db.exec("set role service_role");
    const rows = await db.query<{ user_id: string; kind: string }>(
      `select user_id, kind::text
       from public.member_notifications
       where event_id = $1 and kind = 'new_proposed_time'`,
      [eventId],
    );
    expect(rows.rows).toHaveLength(1);
    expect(rows.rows[0].user_id).toBe(ids.member);

    const otherNotes = await db.query(
      `select 1 from public.member_notifications
       where event_id = $1 and user_id = $2 and kind = 'new_proposed_time'`,
      [eventId, ids.other],
    );
    expect(otherNotes.rows).toHaveLength(0);
  });

  it("skips alerts when new_proposed_time_alerts_enabled is off", async () => {
    const { groupId, eventId, firstCandidate } = await seedOpenHui();

    await asUser(db, ids.member);
    await db.query(
      `update public.profiles set new_proposed_time_alerts_enabled = false where id = $1`,
      [ids.member],
    );
    await db.query(
      `insert into public.event_responses (event_id, candidate_id, user_id, response, visibility)
       values ($1, $2, $3, 'yes', 'private')`,
      [eventId, firstCandidate, ids.member],
    );

    await asUser(db, ids.owner);
    await db.query(
      `insert into public.event_candidates (event_id, group_id, starts_at, proposed_by)
       values ($1, $2, '2026-12-02T10:00:00Z', $3)`,
      [eventId, groupId, ids.owner],
    );

    await asUser(db, null);
    await db.exec("set role service_role");
    const rows = await db.query(
      `select 1 from public.member_notifications
       where event_id = $1 and user_id = $2 and kind = 'new_proposed_time'`,
      [eventId, ids.member],
    );
    expect(rows.rows).toHaveLength(0);

    const outbox = await db.query(
      `select 1
       from public.notification_push_outbox o
       join public.member_notifications n on n.id = o.notification_id
       where n.event_id = $1 and n.user_id = $2 and n.kind = 'new_proposed_time'`,
      [eventId, ids.member],
    );
    expect(outbox.rows).toHaveLength(0);
  });

  it("dedupes burst adds to one alert per member", async () => {
    const { groupId, eventId, firstCandidate } = await seedOpenHui();

    await asUser(db, ids.member);
    await db.query(
      `update public.profiles set new_proposed_time_alerts_enabled = true where id = $1`,
      [ids.member],
    );
    await db.query(
      `insert into public.event_responses (event_id, candidate_id, user_id, response, visibility)
       values ($1, $2, $3, 'yes', 'private')`,
      [eventId, firstCandidate, ids.member],
    );

    await asUser(db, ids.owner);
    await db.query(
      `insert into public.event_candidates (event_id, group_id, starts_at, proposed_by)
       values ($1, $2, '2026-12-03T10:00:00Z', $3),
              ($1, $2, '2026-12-04T10:00:00Z', $3)`,
      [eventId, groupId, ids.owner],
    );

    await asUser(db, null);
    await db.exec("set role service_role");
    const rows = await db.query<{ count: string }>(
      `select count(*)::text as count
       from public.member_notifications
       where event_id = $1 and user_id = $2 and kind = 'new_proposed_time'`,
      [eventId, ids.member],
    );
    expect(Number(rows.rows[0].count)).toBe(1);
  });
});
