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
  outsider: string;
};

let db: PGlite;
let ids: Ids;
let groupId: string;
let eventId: string;
let categoryId: string;

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

describe("contributions (HUI-018)", () => {
  beforeAll(async () => {
    db = new PGlite();
    await db.exec(HARNESS_SQL);

    const dir = path.join(process.cwd(), "supabase", "migrations");
    const files = (await readdir(dir)).filter((file) => file.endsWith(".sql")).sort();
    for (const file of files) {
      await db.exec(await readFile(path.join(dir, file), "utf8"));
    }

    ids = {
      owner: await createUser(db, "contrib-owner@hui.test", "Olivia Owner"),
      member: await createUser(db, "contrib-member@hui.test", "Mia Member"),
      outsider: await createUser(db, "contrib-outsider@hui.test", "Omar Outsider"),
    };

    await asUser(db, ids.owner);
    groupId = (
      await db.query<{ create_group: string }>(`select public.create_group($1) as create_group`, [
        "Contribution group",
      ])
    ).rows[0].create_group;

    await db.query(
      `insert into public.group_memberships (group_id, user_id, role) values ($1, $2, 'member')`,
      [groupId, ids.member],
    );

    const category = await db.query<{ id: string }>(
      `insert into public.contribution_categories (group_id, name) values ($1, 'Dessert') returning id`,
      [groupId],
    );
    categoryId = category.rows[0].id;

    const event = await db.query<{ id: string }>(
      `insert into public.events (group_id, title, status, created_by)
       values ($1, 'Potluck', 'proposing', $2) returning id`,
      [groupId, ids.owner],
    );
    eventId = event.rows[0].id;
  }, 60_000);

  afterEach(async () => {
    if (db) {
      await asUser(db, null);
    }
  });

  afterAll(async () => {
    await db?.close();
  });

  it("lets admins manage categories and blocks members", async () => {
    await asUser(db, ids.member);
    const denied = await expectFail(() =>
      db.query(`insert into public.contribution_categories (group_id, name) values ($1, 'Drinks')`, [
        groupId,
      ]),
    );
    expect(denied).toMatch(/policy|permission|denied/i);

    await asUser(db, ids.owner);
    await db.query(`insert into public.contribution_categories (group_id, name) values ($1, 'Drinks')`, [
      groupId,
    ]);

    await db.query(
      `update public.contribution_categories set archived_at = now() where group_id = $1 and name = 'Drinks'`,
      [groupId],
    );

    const historical = await db.query<{ count: string }>(
      `select count(*)::text as count from public.contribution_categories where group_id = $1 and name = 'Drinks'`,
      [groupId],
    );
    expect(Number(historical.rows[0].count)).toBe(1);
  });

  it("claims, updates, and releases contributions", async () => {
    await asUser(db, ids.member);
    const contributionId = (
      await db.query<{ claim_event_contribution: string }>(
        `select public.claim_event_contribution($1, $2, $3) as claim_event_contribution`,
        [eventId, categoryId, "Chocolate cake"],
      )
    ).rows[0].claim_event_contribution;

    const row = await db.query<{ label: string; display_name: string; user_id: string }>(
      `select label, display_name, user_id from public.event_contributions where id = $1`,
      [contributionId],
    );
    expect(row.rows[0]).toMatchObject({
      label: "Chocolate cake",
      display_name: "Mia Member",
      user_id: ids.member,
    });

    await db.query(`select public.update_my_event_contribution($1, $2)`, [
      contributionId,
      "Brownies",
    ]);
    const updated = await db.query<{ label: string }>(
      `select label from public.event_contributions where id = $1`,
      [contributionId],
    );
    expect(updated.rows[0].label).toBe("Brownies");

    await db.query(`select public.release_event_contribution($1)`, [contributionId]);
    const gone = await db.query<{ count: string }>(
      `select count(*)::text as count from public.event_contributions where id = $1`,
      [contributionId],
    );
    expect(Number(gone.rows[0].count)).toBe(0);
  });

  it("prevents duplicate category claims and outsider access", async () => {
    await asUser(db, ids.owner);
    await db.query(`select public.claim_event_contribution($1, $2, null)`, [eventId, categoryId]);

    const duplicate = await expectFail(() =>
      db.query(`select public.claim_event_contribution($1, $2, null)`, [eventId, categoryId]),
    );
    expect(duplicate).toMatch(/already claimed/i);

    await asUser(db, ids.outsider);
    const outsiderRead = await db.query<{ count: string }>(
      `select count(*)::text as count from public.event_contributions where event_id = $1`,
      [eventId],
    );
    expect(Number(outsiderRead.rows[0].count)).toBe(0);
  });

  it("blocks editing another member's contribution", async () => {
    await asUser(db, ids.owner);
    const contributionId = (
      await db.query<{ id: string }>(
        `select id from public.event_contributions where event_id = $1 limit 1`,
        [eventId],
      )
    ).rows[0].id;

    await asUser(db, ids.member);
    const error = await expectFail(() =>
      db.query(`select public.update_my_event_contribution($1, $2)`, [contributionId, "Stolen"]),
    );
    expect(error).toMatch(/not found|cannot be updated/i);
  });

  it("closes contributions for cancelled events", async () => {
    const cancelledEvent = (
      await db.query<{ id: string }>(
        `insert into public.events (group_id, title, status, created_by, cancelled_at)
         values ($1, 'Cancelled potluck', 'cancelled', $2, now()) returning id`,
        [groupId, ids.owner],
      )
    ).rows[0].id;

    await asUser(db, ids.member);
    const error = await expectFail(() =>
      db.query(`select public.claim_event_contribution($1, $2, null)`, [
        cancelledEvent,
        categoryId,
      ]),
    );
    expect(error).toMatch(/cancelled/i);
  });
});
