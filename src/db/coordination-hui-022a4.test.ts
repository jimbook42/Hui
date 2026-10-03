import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { PGlite } from "@electric-sql/pglite";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

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
  isaac: string;
  jamie: string;
};

let db: PGlite;
let ids: Ids;
let groupId: string;
let mainCategoryId: string;

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

async function insertProposingEvent(
  database: PGlite,
  title: string,
): Promise<{ eventId: string; candidateId: string }> {
  await asUser(database, ids.owner);
  const event = await database.query<{ id: string }>(
    `insert into public.events (group_id, title, status, created_by)
     values ($1, $2, 'proposing', $3) returning id`,
    [groupId, title, ids.owner],
  );
  const eventId = event.rows[0].id;
  const candidate = await database.query<{ id: string }>(
    `insert into public.event_candidates (event_id, starts_at, ends_at, proposed_by)
     values ($1, '2032-10-10T05:00:00Z', '2032-10-10T08:00:00Z', $2) returning id`,
    [eventId, ids.owner],
  );
  return { eventId, candidateId: candidate.rows[0].id };
}

async function respondYes(database: PGlite, userId: string, candidateId: string) {
  await asUser(database, userId);
  await database.query(
    `insert into public.event_responses (candidate_id, user_id, response, visibility)
     values ($1, $2, 'yes', 'group')
     on conflict (candidate_id, user_id) do update set response = excluded.response`,
    [candidateId, userId],
  );
}

async function mainContribution(database: PGlite, eventId: string) {
  return database.query<{ user_id: string | null; status: string }>(
    `select ec.user_id::text as user_id, ec.status::text as status
     from public.event_contributions ec
     where ec.event_id = $1 and ec.category_id = $2`,
    [eventId, mainCategoryId],
  );
}

describe("coordination HUI-022A.4 accepted-host swap", () => {
  beforeAll(async () => {
    db = new PGlite();
    await db.exec(HARNESS_SQL);
    const dir = path.join(process.cwd(), "supabase", "migrations");
    const files = (await readdir(dir)).filter((file) => file.endsWith(".sql")).sort();
    for (const file of files) {
      await db.exec(await readFile(path.join(dir, file), "utf8"));
    }

    ids = {
      owner: await createUser(db, "a4-owner@hui.test", "Olivia Owner"),
      isaac: await createUser(db, "a4-isaac@hui.test", "Isaac First"),
      jamie: await createUser(db, "a4-jamie@hui.test", "Jamie Later"),
    };

    await asUser(db, ids.owner);
    groupId = (
      await db.query<{ create_group: string }>(`select public.create_group($1) as create_group`, [
        "A4 group",
      ])
    ).rows[0].create_group;

    await db.query(
      `insert into public.group_memberships (group_id, user_id, role)
       values ($1, $2, 'member'), ($1, $3, 'member')`,
      [groupId, ids.isaac, ids.jamie],
    );

    const category = await db.query<{ id: string }>(
      `insert into public.contribution_categories (group_id, name, follows_host)
       values ($1, 'Main', true) returning id`,
      [groupId],
    );
    mainCategoryId = category.rows[0].id;
  }, 120_000);

  beforeEach(async () => {
    await asUser(db, ids.owner);
    await db.query(
      `update public.group_settings set hosting_enabled = true where group_id = $1`,
      [groupId],
    );
  });

  afterEach(async () => {
    await asUser(db, null);
  });

  afterAll(async () => {
    await db?.close();
  });

  it("accepted host can swap while proposing and Main follows replacement after accept", async () => {
    const { eventId, candidateId } = await insertProposingEvent(db, "Accept then swap");
    await respondYes(db, ids.isaac, candidateId);
    await respondYes(db, ids.jamie, candidateId);

    const firstProposed = await db.query<{ user_id: string }>(
      `select user_id::text as user_id from public.host_assignments
       where event_id = $1 and status = 'proposed' order by created_at desc limit 1`,
      [eventId],
    );
    const memberA = firstProposed.rows[0]?.user_id;
    expect(memberA).toBeTruthy();
    const memberB = memberA === ids.isaac ? ids.jamie : ids.isaac;

    await asUser(db, memberA);
    await db.query(`select public.respond_to_host_assignment($1, true)`, [eventId]);

    const accepted = await db.query(
      `select 1 from public.host_assignments where event_id = $1 and user_id = $2 and status = 'accepted'`,
      [eventId, memberA],
    );
    expect(accepted.rows).toHaveLength(1);

    const mainAfterAccept = await mainContribution(db, eventId);
    expect(mainAfterAccept.rows[0]?.user_id).toBe(memberA);
    expect(mainAfterAccept.rows[0]?.status).toBe("accepted");

    await db.query(`select public.request_host_swap($1)`, [eventId]);

    const swappedOut = await db.query(
      `select 1 from public.host_assignments
       where event_id = $1 and user_id = $2 and status = 'swapped_out'`,
      [eventId, memberA],
    );
    expect(swappedOut.rows.length).toBeGreaterThan(0);

    const stillAccepted = await db.query(
      `select 1 from public.host_assignments where event_id = $1 and status = 'accepted'`,
      [eventId],
    );
    expect(stillAccepted.rows).toHaveLength(0);

    const replacement = await db.query<{ user_id: string }>(
      `select user_id::text as user_id from public.host_assignments
       where event_id = $1 and status = 'proposed' order by created_at desc limit 1`,
      [eventId],
    );
    expect(replacement.rows[0]?.user_id).toBe(memberB);

    const mainAfterSwap = await mainContribution(db, eventId);
    expect(mainAfterSwap.rows[0]?.user_id ?? null).toBeNull();

    await asUser(db, replacement.rows[0].user_id);
    await db.query(`select public.respond_to_host_assignment($1, true)`, [eventId]);

    const replacementAccepted = await db.query(
      `select 1 from public.host_assignments where event_id = $1 and user_id = $2 and status = 'accepted'`,
      [eventId, memberB],
    );
    expect(replacementAccepted.rows).toHaveLength(1);

    const mainFinal = await mainContribution(db, eventId);
    expect(mainFinal.rows[0]?.user_id).toBe(memberB);
    expect(mainFinal.rows[0]?.status).toBe("accepted");

    const event = await db.query<{ status: string }>(
      `select status::text as status from public.events where id = $1`,
      [eventId],
    );
    expect(event.rows[0].status).toBe("proposing");
  });
});
