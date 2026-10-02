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

describe("account deletion (HUI-012B)", () => {
  beforeAll(async () => {
    db = new PGlite();
    await db.exec(HARNESS_SQL);

    const dir = path.join(process.cwd(), "supabase", "migrations");
    const files = (await readdir(dir)).filter((file) => file.endsWith(".sql")).sort();
    for (const file of files) {
      await db.exec(await readFile(path.join(dir, file), "utf8"));
    }

    ids = {
      owner: await createUser(db, "owner-del@hui.test", "Owner Del"),
      member: await createUser(db, "member-del@hui.test", "Member Del"),
      leaver: await createUser(db, "leaver-del@hui.test", "Leaver Name"),
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

  it("rejects unauthenticated deletion", async () => {
    await asUser(db, null);
    const error = await expectFail(() =>
      db.query(`select public.delete_my_account_data()`),
    );
    expect(error).toMatch(/not authenticated/);
  });

  it("blocks owners who still have other active members", async () => {
    await asUser(db, ids.owner);
    const groupId = (
      await db.query<{ create_group: string }>(
        `select public.create_group($1) as create_group`,
        ["Blocked delete"],
      )
    ).rows[0].create_group;
    await asUser(db, null);
    await db.query(
      `insert into public.group_memberships (group_id, user_id, role)
       values ($1, $2, 'member')`,
      [groupId, ids.member],
    );

    await asUser(db, ids.owner);
    const error = await expectFail(() =>
      db.query(`select public.delete_my_account_data()`),
    );
    expect(error).toMatch(/transfer group ownership/);
  });

  it("deletes sole-member groups and anonymises the profile", async () => {
    const soloId = await createUser(db, "solo@hui.test", "Solo User");
    await asUser(db, soloId);
    const groupId = (
      await db.query<{ create_group: string }>(
        `select public.create_group($1) as create_group`,
        ["Solo circle"],
      )
    ).rows[0].create_group;

    await db.query(`select public.delete_my_account_data()`);

    await asUser(db, null);
    const group = await db.query(`select id from public.groups where id = $1`, [
      groupId,
    ]);
    const profile = await db.query<{
      display_name: string;
      account_deleted_at: string | null;
    }>(
      `select display_name, account_deleted_at::text
       from public.profiles where id = $1`,
      [soloId],
    );

    expect(group.rows).toEqual([]);
    expect(profile.rows[0].display_name).toBe("Former member");
    expect(profile.rows[0].account_deleted_at).toBeTruthy();
  });

  it("removes personal dietary data and private responses but keeps group-visible history", async () => {
    await asUser(db, ids.owner);
    const groupId = (
      await db.query<{ create_group: string }>(
        `select public.create_group($1) as create_group`,
        ["Shared history"],
      )
    ).rows[0].create_group;
    await asUser(db, null);
    await db.query(
      `insert into public.group_memberships (group_id, user_id, role)
       values ($1, $2, 'member')`,
      [groupId, ids.leaver],
    );

    await asUser(db, ids.leaver);
    const dietary = await db.query<{ id: string }>(
      `insert into public.dietary_entries (user_id, category, label)
       values ($1, 'preference', 'No coriander')
       returning id`,
      [ids.leaver],
    );
    const dietaryId = dietary.rows[0].id;
    await db.query(
      `insert into public.dietary_entry_shares (dietary_entry_id, group_id)
       values ($1, $2)`,
      [dietaryId, groupId],
    );

    await asUser(db, ids.owner);
    const event = await db.query<{ id: string }>(
      `insert into public.events (group_id, title, status, created_by)
       values ($1, 'Dinner', 'proposing', $2)
       returning id`,
      [groupId, ids.owner],
    );
    const eventId = event.rows[0].id;
    const candidates = await db.query<{ id: string }>(
      `insert into public.event_candidates (
         event_id, group_id, starts_at, ends_at, proposed_by
       ) values
         ($1, $2, now() + interval '1 day', now() + interval '1 day 2 hours', $3),
         ($1, $2, now() + interval '2 days', now() + interval '2 days 2 hours', $3)
       returning id`,
      [eventId, groupId, ids.owner],
    );
    const privateCandidateId = candidates.rows[0].id;
    const groupCandidateId = candidates.rows[1].id;

    await asUser(db, ids.leaver);
    await db.query(
      `insert into public.event_responses (
         candidate_id, event_id, group_id, user_id, response, visibility
       ) values ($1, $2, $3, $4, 'yes', 'private')`,
      [privateCandidateId, eventId, groupId, ids.leaver],
    );
    await db.query(
      `insert into public.event_responses (
         candidate_id, event_id, group_id, user_id, response, visibility
       ) values ($1, $2, $3, $4, 'yes', 'group')`,
      [groupCandidateId, eventId, groupId, ids.leaver],
    );

    await db.query(`select public.delete_my_account_data()`);

    await asUser(db, null);
    const dietaryRows = await db.query(
      `select id from public.dietary_entries where user_id = $1`,
      [ids.leaver],
    );
    const privateResponses = await db.query(
      `select id from public.event_responses
       where user_id = $1 and visibility = 'private'`,
      [ids.leaver],
    );
    const groupResponses = await db.query(
      `select id from public.event_responses
       where user_id = $1 and visibility = 'group'`,
      [ids.leaver],
    );
    const membership = await db.query<{ status: string }>(
      `select status::text as status
       from public.group_memberships
       where group_id = $1 and user_id = $2`,
      [groupId, ids.leaver],
    );
    const eventStillThere = await db.query(`select id from public.events where id = $1`, [
      eventId,
    ]);

    expect(dietaryRows.rows).toEqual([]);
    expect(privateResponses.rows).toEqual([]);
    expect(groupResponses.rows).toHaveLength(1);
    expect(membership.rows[0].status).toBe("removed");
    expect(eventStillThere.rows).toHaveLength(1);
  });

  it("allows re-registration with a new auth user id and fresh profile", async () => {
    const email = "reregister@hui.test";
    const firstId = await createUser(db, email, "Original Name");
    await asUser(db, firstId);
    await db.query(`select public.delete_my_account_data()`);
    await asUser(db, null);
    await db.query(`delete from auth.users where id = $1`, [firstId]);

    const secondId = await createUser(db, email, "New Signup Name");
    const oldProfile = await db.query<{ display_name: string }>(
      `select display_name from public.profiles where id = $1`,
      [firstId],
    );
    const newProfile = await db.query<{ display_name: string }>(
      `select display_name from public.profiles where id = $1`,
      [secondId],
    );

    expect(secondId).not.toBe(firstId);
    expect(oldProfile.rows[0].display_name).toBe("Former member");
    expect(newProfile.rows[0].display_name).toBe("New Signup Name");
  });

  it("rejects duplicate deletion", async () => {
    const userId = await createUser(db, "twice@hui.test", "Twice");
    await asUser(db, userId);
    await db.query(`select public.delete_my_account_data()`);
    const error = await expectFail(() =>
      db.query(`select public.delete_my_account_data()`),
    );
    expect(error).toMatch(/already deleted/);
  });
});
