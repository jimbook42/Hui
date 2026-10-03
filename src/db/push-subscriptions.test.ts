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

const ENDPOINT_A = "https://push.example.test/subscriptions/device-a";
const ENDPOINT_B = "https://push.example.test/subscriptions/device-b";
const KEY_A = "B".repeat(40);
const KEY_B = "C".repeat(40);
const AUTH = "D".repeat(24);

let db: PGlite;
let ownerId: string;
let memberId: string;
let outsiderId: string;
let leaverId: string;
let groupId: string;

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

async function asUser(
  database: PGlite,
  userId: string | null,
  role: "anon" | "authenticated" | "service_role" = "authenticated",
) {
  await database.exec("reset role");
  await database.query(`select set_config('request.jwt.claim.sub', $1, false)`, [
    userId ?? "",
  ]);
  if (userId) {
    await database.exec(`set role ${role}`);
  } else if (role === "anon" || role === "service_role") {
    await database.exec(`set role ${role}`);
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

async function register(
  userId: string,
  endpoint: string,
  p256dh: string,
) {
  await asUser(db, userId);
  const created = await db.query<{ register_push_subscription: string }>(
    `select public.register_push_subscription($1, $2, $3, 'Hui test browser') as register_push_subscription`,
    [endpoint, p256dh, AUTH],
  );
  return created.rows[0].register_push_subscription;
}

describe("web push subscriptions (HUI-023)", () => {
  beforeAll(async () => {
    db = new PGlite();
    await db.exec(HARNESS_SQL);

    const dir = path.join(process.cwd(), "supabase", "migrations");
    const files = (await readdir(dir)).filter((file) => file.endsWith(".sql")).sort();
    for (const file of files) {
      await db.exec(await readFile(path.join(dir, file), "utf8"));
    }

    ownerId = await createUser(db, "push-owner@hui.test", "Pat Owner");
    memberId = await createUser(db, "push-member@hui.test", "Pam Member");
    outsiderId = await createUser(db, "push-outsider@hui.test", "Otto Outsider");
    leaverId = await createUser(db, "push-leaver@hui.test", "Lee Leaver");

    await asUser(db, ownerId);
    groupId = (
      await db.query<{ create_group: string }>(`select public.create_group($1) as create_group`, [
        "Push group",
      ])
    ).rows[0].create_group;
    await db.query(
      `insert into public.group_memberships (group_id, user_id, role) values ($1, $2, 'member')`,
      [groupId, memberId],
    );
    await db.query(
      `insert into public.group_memberships (group_id, user_id, role) values ($1, $2, 'member')`,
      [groupId, leaverId],
    );
  }, 90_000);

  afterEach(async () => {
    if (db) {
      await asUser(db, null);
    }
  });

  afterAll(async () => {
    await db?.close();
  });

  it("stores multiple subscriptions and updates a duplicate endpoint in place", async () => {
    const first = await register(memberId, ENDPOINT_A, KEY_A);
    const second = await register(memberId, ENDPOINT_A, KEY_B);
    const other = await register(memberId, ENDPOINT_B, KEY_A);
    expect(first).toBe(second);
    expect(other).not.toBe(first);

    await asUser(db, null, "service_role");
    const rows = await db.query<{ endpoint: string; p256dh: string; user_id: string }>(
      `select endpoint, p256dh, user_id::text from public.push_subscriptions where user_id = $1 order by endpoint`,
      [memberId],
    );
    expect(rows.rows).toHaveLength(2);
    expect(rows.rows.map((row) => row.endpoint)).toEqual([ENDPOINT_A, ENDPOINT_B]);
    expect(rows.rows[0]?.p256dh).toBe(KEY_B);
  });

  it("lets a member remove only their own subscription and hides keys from clients", async () => {
    await register(memberId, ENDPOINT_A, KEY_B);
    await register(memberId, ENDPOINT_B, KEY_A);

    await asUser(db, outsiderId);
    const removed = await db.query<{ remove_push_subscription: boolean }>(
      `select public.remove_push_subscription($1) as remove_push_subscription`,
      [ENDPOINT_B],
    );
    expect(removed.rows[0].remove_push_subscription).toBe(false);

    const denied = await expectFail(() =>
      db.query(`select endpoint, p256dh, auth_key from public.push_subscriptions`),
    );
    expect(denied).toMatch(/permission denied|row-level security/i);

    await asUser(db, memberId);
    const state = await db.query<Record<string, unknown>>(
      `select * from public.my_push_subscription_state($1)`,
      [ENDPOINT_A],
    );
    expect(Object.keys(state.rows[0] ?? {}).sort()).toEqual([
      "device_subscribed",
      "subscription_count",
      "web_push_enabled",
    ]);
    expect(state.rows[0]).toMatchObject({
      device_subscribed: true,
      web_push_enabled: false,
    });
    expect(Number(state.rows[0]?.subscription_count)).toBeGreaterThanOrEqual(2);
    expect(JSON.stringify(state.rows[0])).not.toContain(KEY_B);

    const ownRemoved = await db.query<{ remove_push_subscription: boolean }>(
      `select public.remove_push_subscription($1) as remove_push_subscription`,
      [ENDPOINT_B],
    );
    expect(ownRemoved.rows[0].remove_push_subscription).toBe(true);

    await asUser(db, null, "service_role");
    const remaining = await db.query(
      `select 1 from public.push_subscriptions where endpoint = $1`,
      [ENDPOINT_B],
    );
    expect(remaining.rows).toHaveLength(0);
  });

  it("blocks anonymous registration and direct outbox reads", async () => {
    await asUser(db, null, "anon");
    const anonRegister = await expectFail(() =>
      db.query(`select public.register_push_subscription($1, $2, $3, null)`, [
        ENDPOINT_A,
        KEY_A,
        AUTH,
      ]),
    );
    expect(anonRegister).toMatch(/permission denied|not authenticated/i);

    await asUser(db, memberId);
    const outbox = await expectFail(() =>
      db.query(`select id from public.notification_push_outbox`),
    );
    expect(outbox).toMatch(/permission denied|row-level security/i);
  });

  it("keeps in-app notifications when push is off and enqueues one outbox row", async () => {
    await asUser(db, memberId);
    await db.query(`update public.profiles set web_push_enabled = false where id = $1`, [memberId]);

    await asUser(db, ownerId);
    const event = await db.query<{ id: string }>(
      `insert into public.events (group_id, title, status, created_by)
       values ($1, 'Push dinner', 'proposing', $2) returning id`,
      [groupId, ownerId],
    );

    await asUser(db, memberId);
    const notes = await db.query(
      `select id from public.member_notifications where user_id = $1 and event_id = $2`,
      [memberId, event.rows[0].id],
    );
    expect(notes.rows).toHaveLength(1);

    await asUser(db, null, "service_role");
    const outbox = await db.query(
      `select status from public.notification_push_outbox where notification_id = $1`,
      [notes.rows[0] ? (notes.rows[0] as { id: string }).id : null],
    );
    expect(outbox.rows).toEqual([{ status: "pending" }]);

    await asUser(db, null);
    const eventId = event.rows[0].id;
    const again = await db.query<{ queue_member_notification: string | null }>(
      `select public.queue_member_notification(
         $1::uuid, 'event_proposed', 'T', 'B', $2::uuid, $3::uuid, $4
       ) as queue_member_notification`,
      [memberId, groupId, eventId, `event_proposed:${eventId}:${memberId}`],
    );
    expect(again.rows[0].queue_member_notification).toBeNull();
    const stillOne = await db.query(
      `select 1 from public.notification_push_outbox where user_id = $1`,
      [memberId],
    );
    expect(stillOne.rows).toHaveLength(1);
  });

  it("removes push subscriptions when the account is deleted", async () => {
    await register(leaverId, "https://push.example.test/subscriptions/leaver", KEY_A);
    await asUser(db, leaverId);
    await db.query(`update public.profiles set web_push_enabled = true where id = $1`, [leaverId]);
    await db.query(`select public.delete_my_account_data()`);

    await asUser(db, null, "service_role");
    const rows = await db.query(
      `select 1 from public.push_subscriptions where user_id = $1`,
      [leaverId],
    );
    expect(rows.rows).toHaveLength(0);
    const profile = await db.query<{ web_push_enabled: boolean }>(
      `select web_push_enabled from public.profiles where id = $1`,
      [leaverId],
    );
    expect(profile.rows[0]?.web_push_enabled).toBe(false);
  });
});
