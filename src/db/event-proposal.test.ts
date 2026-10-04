import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

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

type Ids = { owner: string; member: string; outsider: string };

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

describe("propose_group_event (HUI-026A)", () => {
  beforeAll(async () => {
    db = new PGlite();
    await db.exec(HARNESS_SQL);
    const dir = path.join(process.cwd(), "supabase", "migrations");
    const files = (await readdir(dir)).filter((file) => file.endsWith(".sql")).sort();
    for (const file of files) {
      await db.exec(await readFile(path.join(dir, file), "utf8"));
    }

    ids = {
      owner: await createUser(db, "prop-owner@hui.test", "Prop Owner"),
      member: await createUser(db, "prop-member@hui.test", "Prop Member"),
      outsider: await createUser(db, "prop-out@hui.test", "Prop Outsider"),
    };

    await asUser(db, ids.owner);
    groupId = (
      await db.query<{ create_group: string }>(`select public.create_group($1) as create_group`, [
        "Proposal Group",
      ])
    ).rows[0].create_group;
  }, 60_000);

  afterAll(async () => {
    await db.close();
  });

  it("rejects proposal without candidates", async () => {
    await asUser(db, ids.owner);
    const err = await expectFail(async () => {
      await db.query(`select public.propose_group_event($1, $2, null, null, null, $3::jsonb, false, null)`, [
        groupId,
        "No times",
        "[]",
      ]);
    });
    expect(err).toMatch(/time/i);
  });

  it("creates proposing event with candidates and unset final timing", async () => {
    const startsAt = wallClockToUtcIso("2026-12-05T18:00", "Pacific/Auckland");
    const endsAt = wallClockToUtcIso("2026-12-05T21:00", "Pacific/Auckland");
    expect(startsAt).toBeTruthy();
    expect(endsAt).toBeTruthy();

    await asUser(db, ids.owner);
    const eventId = (
      await db.query<{ propose_group_event: string }>(
        `select public.propose_group_event($1, $2, $3, null, null, $4::jsonb, false, null) as propose_group_event`,
        [
          groupId,
          "Holiday dinner",
          "Park pavilion",
          JSON.stringify([{ starts_at: startsAt, ends_at: endsAt }]),
        ],
      )
    ).rows[0].propose_group_event;

    const event = await db.query<{ status: string; starts_at: string | null; ends_at: string | null }>(
      `select status, starts_at, ends_at from public.events where id = $1`,
      [eventId],
    );
    expect(event.rows[0]).toMatchObject({
      status: "proposing",
      starts_at: null,
      ends_at: null,
    });

    const candidates = await db.query<{ count: string }>(
      `select count(*)::text as count from public.event_candidates where event_id = $1 and status = 'proposed'`,
      [eventId],
    );
    expect(candidates.rows[0].count).toBe("1");
  });

  it("denies outsiders from proposing", async () => {
    const startsAt = wallClockToUtcIso("2026-12-06T18:00", "Pacific/Auckland");
    const endsAt = wallClockToUtcIso("2026-12-06T21:00", "Pacific/Auckland");
    await asUser(db, ids.outsider);
    const err = await expectFail(async () => {
      await db.query(`select public.propose_group_event($1, $2, null, null, null, $3::jsonb, false, null)`, [
        groupId,
        "Intrusion",
        JSON.stringify([{ starts_at: startsAt, ends_at: endsAt }]),
      ]);
    });
    expect(err).toMatch(/cannot propose|not found|member/i);
  });
});
