import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { PGlite } from "@electric-sql/pglite";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

/**
 * HUI-026U.3: members are not trapped by an earlier answer. Attendance on the confirmed time stays
 * editable until the event is completed or cancelled; declining releases the member's own
 * claimed contributions; nothing else about a confirmed event becomes editable.
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

let db: PGlite;
const ids = { owner: "", member: "", outsider: "" };
let groupId = "";
let categoryId = "";

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

async function createEventWithTimes(title: string) {
  await asUser(db, ids.owner);
  const event = await db.query<{ id: string }>(
    `insert into public.events (group_id, title, status, created_by)
     values ($1, $2, 'proposing', $3) returning id`,
    [groupId, title, ids.owner],
  );
  const eventId = event.rows[0].id;
  const candidate = async (startsAt: string, endsAt: string | null) =>
    (
      await db.query<{ id: string }>(
        `insert into public.event_candidates (event_id, starts_at, ends_at, proposed_by)
         values ($1, $2, $3, $4) returning id`,
        [eventId, startsAt, endsAt, ids.owner],
      )
    ).rows[0].id;
  const earlier = await candidate("2026-11-10T18:00:00Z", "2026-11-10T20:00:00Z");
  // The later time is start-only: ends_at is optional (HUI-026U.3).
  const later = await candidate("2026-11-20T18:00:00Z", null);
  return { eventId, earlier, later };
}

async function respond(userId: string, candidateId: string, response: "yes" | "no" | "maybe") {
  await asUser(db, userId);
  await db.query(
    `insert into public.event_responses (candidate_id, user_id, response, visibility)
     values ($1, $2, $3, 'group')
     on conflict (candidate_id, user_id) do update set response = excluded.response`,
    [candidateId, userId, response],
  );
}

async function responseOf(userId: string, candidateId: string): Promise<string | null> {
  await asUser(db, null);
  const result = await db.query<{ response: string }>(
    `select response::text as response from public.event_responses
     where candidate_id = $1 and user_id = $2`,
    [candidateId, userId],
  );
  return result.rows[0]?.response ?? null;
}

async function claim(eventId: string, userId: string, label: string) {
  await asUser(db, userId);
  await db.query(`select public.claim_event_contribution($1, $2, $3)`, [eventId, categoryId, label]);
}

async function contributionCount(eventId: string, userId: string): Promise<number> {
  await asUser(db, null);
  const result = await db.query<{ count: string }>(
    `select count(*)::text as count from public.event_contributions
     where event_id = $1 and user_id = $2`,
    [eventId, userId],
  );
  return Number(result.rows[0].count);
}

describe("attendance after confirmation (HUI-026U.3)", () => {
  beforeAll(async () => {
    db = new PGlite();
    await db.exec(HARNESS_SQL);

    const dir = path.join(process.cwd(), "supabase", "migrations");
    const files = (await readdir(dir)).filter((file) => file.endsWith(".sql")).sort();
    for (const file of files) {
      await db.exec(await readFile(path.join(dir, file), "utf8"));
    }

    ids.owner = await createUser(db, "att-owner@hui.test", "Olivia Owner");
    ids.member = await createUser(db, "att-member@hui.test", "Mia Member");
    ids.outsider = await createUser(db, "att-outsider@hui.test", "Owen Outsider");

    await asUser(db, ids.owner);
    groupId = (
      await db.query<{ create_group: string }>(`select public.create_group($1) as create_group`, [
        "Attendance group",
      ])
    ).rows[0].create_group;
    await db.query(
      `insert into public.group_memberships (group_id, user_id, role) values ($1, $2, 'member')`,
      [groupId, ids.member],
    );
    await db.query(
      `update public.group_settings
       set minimum_attendees = 1, consensus_rule = 'minimum_attendees', maybe_responses_enabled = true
       where group_id = $1`,
      [groupId],
    );
    categoryId = (
      await db.query<{ id: string }>(
        `insert into public.contribution_categories (group_id, name) values ($1, 'Dessert') returning id`,
        [groupId],
      )
    ).rows[0].id;
  }, 60_000);

  afterEach(async () => {
    if (db) {
      await asUser(db, null);
    }
  });

  afterAll(async () => {
    await db?.close();
  });

  it("accepts a start-only candidate time", async () => {
    const { eventId } = await createEventWithTimes("Start-only dinner");
    await asUser(db, null);
    const rows = await db.query<{ ends_at: string | null }>(
      `select ends_at::text as ends_at from public.event_candidates
       where event_id = $1 order by starts_at`,
      [eventId],
    );
    expect(rows.rows.map((row) => row.ends_at === null)).toEqual([false, true]);
  });

  it("rejects an end that is not after the start", async () => {
    const { eventId } = await createEventWithTimes("Bad end");
    await asUser(db, ids.owner);
    const error = await expectFail(() =>
      db.query(
        `insert into public.event_candidates (event_id, starts_at, ends_at, proposed_by)
         values ($1, '2026-12-01T18:00:00Z', '2026-12-01T17:00:00Z', $2)`,
        [eventId, ids.owner],
      ),
    );
    expect(error).toMatch(/check|ends_at/i);
  });

  it("lets members change Yes to Maybe to No on the confirmed time", async () => {
    const { eventId, earlier, later } = await createEventWithTimes("Confirmed change");
    await respond(ids.owner, later, "yes");
    await respond(ids.member, later, "yes");
    await respond(ids.member, earlier, "yes");

    await asUser(db, ids.owner);
    await db.query(`select public.finalise_event($1, $2)`, [eventId, later]);

    await respond(ids.member, later, "maybe");
    expect(await responseOf(ids.member, later)).toBe("maybe");

    await respond(ids.member, later, "no");
    expect(await responseOf(ids.member, later)).toBe("no");

    // And back again: No -> Yes after confirmation.
    await respond(ids.member, later, "yes");
    expect(await responseOf(ids.member, later)).toBe("yes");
  });

  it("still locks answers on times that were not chosen", async () => {
    const { eventId, earlier, later } = await createEventWithTimes("Locked other time");
    await respond(ids.owner, later, "yes");
    await respond(ids.member, earlier, "yes");

    await asUser(db, ids.owner);
    await db.query(`select public.finalise_event($1, $2)`, [eventId, later]);

    await asUser(db, ids.member);
    const error = await expectFail(() =>
      db.query(
        `update public.event_responses set response = 'no' where candidate_id = $1 and user_id = $2`,
        [earlier, ids.member],
      ),
    );
    expect(error).toMatch(/no longer open for scheduling/);
  });

  it("keeps the confirmed time and the candidate list locked", async () => {
    const { eventId, later } = await createEventWithTimes("Still locked");
    await respond(ids.owner, later, "yes");
    await asUser(db, ids.owner);
    await db.query(`select public.finalise_event($1, $2)`, [eventId, later]);

    const addAfter = await expectFail(() =>
      db.query(
        `insert into public.event_candidates (event_id, starts_at, ends_at, proposed_by)
         values ($1, '2026-12-05T18:00:00Z', null, $2)`,
        [eventId, ids.owner],
      ),
    );
    expect(addAfter).toMatch(/no longer open for scheduling/);
  });

  it("locks answers once the event is completed or cancelled", async () => {
    const { eventId, later } = await createEventWithTimes("Cancelled lock");
    await respond(ids.owner, later, "yes");
    await respond(ids.member, later, "yes");
    await asUser(db, ids.owner);
    await db.query(`select public.finalise_event($1, $2)`, [eventId, later]);
    await db.query(`update public.events set status = 'cancelled', cancelled_at = now() where id = $1`, [
      eventId,
    ]);

    await asUser(db, ids.member);
    const error = await expectFail(() =>
      db.query(
        `update public.event_responses set response = 'no' where candidate_id = $1 and user_id = $2`,
        [later, ids.member],
      ),
    );
    expect(error).toMatch(/no longer open for scheduling/);
  });

  it("releases the member's own claimed contribution when they decline a confirmed event", async () => {
    const { eventId, later } = await createEventWithTimes("Release on decline");
    await respond(ids.owner, later, "yes");
    await respond(ids.member, later, "yes");
    await claim(eventId, ids.member, "Chocolate cake");
    expect(await contributionCount(eventId, ids.member)).toBe(1);

    await asUser(db, ids.owner);
    await db.query(`select public.finalise_event($1, $2)`, [eventId, later]);

    await respond(ids.member, later, "maybe");
    expect(await contributionCount(eventId, ids.member)).toBe(1);

    await respond(ids.member, later, "no");
    expect(await contributionCount(eventId, ids.member)).toBe(0);
  });

  it("keeps a contribution while the member is still coming to another proposed time", async () => {
    const { eventId, earlier, later } = await createEventWithTimes("Several times");
    await respond(ids.member, earlier, "yes");
    await respond(ids.member, later, "yes");
    await claim(eventId, ids.member, "Salad");

    await respond(ids.member, earlier, "no");
    expect(await contributionCount(eventId, ids.member)).toBe(1);

    await respond(ids.member, later, "no");
    expect(await contributionCount(eventId, ids.member)).toBe(0);
  });

  it("does not let a non-member answer", async () => {
    const { later } = await createEventWithTimes("Outsider");
    await asUser(db, ids.outsider);
    const error = await expectFail(() =>
      db.query(
        `insert into public.event_responses (candidate_id, user_id, response, visibility)
         values ($1, $2, 'yes', 'group')`,
        [later, ids.outsider],
      ),
    );
    expect(error).toMatch(/policy|active group member|permission|denied|candidate not found/i);
  });
});
