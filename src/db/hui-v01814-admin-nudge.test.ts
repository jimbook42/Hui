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

type Ids = { owner: string; admin: string; host: string; member: string };

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

describe("v0.18.14 admin confirm and availability nudge", () => {
  beforeAll(async () => {
    db = new PGlite();
    await db.exec(HARNESS_SQL);
    const dir = path.join(process.cwd(), "supabase", "migrations");
    const files = (await readdir(dir)).filter((file) => file.endsWith(".sql")).sort();
    for (const file of files) {
      await db.exec(await readFile(path.join(dir, file), "utf8"));
    }
    ids = {
      owner: await createUser(db, "owner-v01814@test", "Owner"),
      admin: await createUser(db, "admin-v01814@test", "Admin"),
      host: await createUser(db, "host-v01814@test", "Host"),
      member: await createUser(db, "member-v01814@test", "Member"),
    };
  }, 180_000);

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
        "v01814 group",
      ])
    ).rows[0].create_group;
    await db.query(
      `insert into public.group_memberships (group_id, user_id, role)
       values ($1, $2, 'member'), ($1, $3, 'admin'), ($1, $4, 'member')`,
      [groupId, ids.member, ids.admin, ids.host],
    );
    await db.query(
      `update public.group_settings set minimum_attendees = 1 where group_id = $1`,
      [groupId],
    );
    return groupId;
  }

  async function seedEvent(groupId: string) {
    const eventId = (
      await db.query<{ id: string }>(
        `insert into public.events (group_id, title, status, created_by, confirm_rule)
         values ($1, 'Test hui', 'proposing', $2, 'when_most_can_come')
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

  async function acceptHost(eventId: string, groupId: string) {
    await asUser(db, ids.owner);
    await db.query(
      `insert into public.host_assignments (event_id, group_id, user_id, status, display_name, assigned_by)
       values ($1, $2, $3, 'accepted', 'Host', $4)`,
      [eventId, groupId, ids.host, ids.owner],
    );
  }

  async function hostSaysYes(eventId: string, candidateId: string) {
    await asUser(db, ids.host);
    await db.query(
      `insert into public.event_responses (event_id, candidate_id, user_id, response, visibility)
       values ($1, $2, $3, 'yes', 'private')
       on conflict (candidate_id, user_id) do update set response = 'yes'`,
      [eventId, candidateId, ids.host],
    );
  }

  it("admin_finalise_event sets confirmation_method admin and enqueues notifications", async () => {
    await db.query(`select set_config('hui.skip_auto_confirm', '1', false)`);
    const groupId = await seedGroup();
    const { eventId, candidateId } = await seedEvent(groupId);
    await acceptHost(eventId, groupId);
    await hostSaysYes(eventId, candidateId);

    await asUser(db, ids.admin);
    await db.query(`select public.admin_finalise_event($1::uuid, $2::uuid)`, [eventId, candidateId]);

    const eventRow = await db.query<{ confirmation_method: string; status: string }>(
      `select confirmation_method::text, status::text from public.events where id = $1`,
      [eventId],
    );
    expect(eventRow.rows[0]?.status).toBe("confirmed");
    expect(eventRow.rows[0]?.confirmation_method).toBe("admin");

    const notifications = await db.query<{ count: string }>(
      `select count(*)::text as count from public.member_notifications where event_id = $1`,
      [eventId],
    );
    expect(Number(notifications.rows[0]?.count ?? 0)).toBeGreaterThan(0);
  });

  it("rejects admin pick when host has not said yes", async () => {
    await db.query(`select set_config('hui.skip_auto_confirm', '1', false)`);
    const groupId = await seedGroup();
    const { eventId, candidateId } = await seedEvent(groupId);
    await acceptHost(eventId, groupId);

    await asUser(db, ids.admin);
    await expect(
      db.query(`select public.admin_finalise_event($1::uuid, $2::uuid)`, [eventId, candidateId]),
    ).rejects.toThrow(/waiting on the host/i);
  });

  it("nudge_event_availability targets only non-responders and rate limits", async () => {
    const groupId = await seedGroup();
    const { eventId, candidateId } = await seedEvent(groupId);

    await asUser(db, ids.owner);
    await db.query(
      `insert into public.event_responses (event_id, candidate_id, user_id, response, visibility)
       values ($1, $2, $3, 'yes', 'private')`,
      [eventId, candidateId, ids.owner],
    );

    const first = await db.query<{ nudge_event_availability: { queued: number } }>(
      `select public.nudge_event_availability($1::uuid) as nudge_event_availability`,
      [eventId],
    );
    expect(first.rows[0]?.nudge_event_availability.queued).toBe(3);

    const second = await db.query<{ nudge_event_availability: { rate_limited: boolean } }>(
      `select public.nudge_event_availability($1::uuid) as nudge_event_availability`,
      [eventId],
    );
    expect(second.rows[0]?.nudge_event_availability.rate_limited).toBe(true);
  });

  it("new proposing events keep a null response deadline without the insert trigger", async () => {
    const groupId = await seedGroup();
    const { eventId } = await seedEvent(groupId);
    const row = await db.query<{ response_deadline_at: string | null }>(
      `select response_deadline_at from public.events where id = $1`,
      [eventId],
    );
    expect(row.rows[0]?.response_deadline_at).toBeNull();
  });
});
