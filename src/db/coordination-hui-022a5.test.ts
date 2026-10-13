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
returns uuid language sql stable as $$
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
end $$;
grant anon to current_user;
grant authenticated to current_user;
grant service_role to current_user;
grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
`;

type Ids = { owner: string; isaac: string; jamie: string };

let db: PGlite;
let ids: Ids;
let groupId: string;
let dessertCategoryId: string;

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
     values ($1, jsonb_build_object('display_name', $2::text)) returning id`,
    [email, displayName],
  );
  return created.rows[0].id;
}

describe("coordination HUI-022A.5 contribution seed scope and host swap", () => {
  beforeAll(async () => {
    db = new PGlite();
    await db.exec(HARNESS_SQL);
    const dir = path.join(process.cwd(), "supabase", "migrations");
    const files = (await readdir(dir)).filter((file) => file.endsWith(".sql")).sort();
    for (const file of files) {
      await db.exec(await readFile(path.join(dir, file), "utf8"));
    }

    ids = {
      owner: await createUser(db, "a5-owner@hui.test", "Olivia Owner"),
      isaac: await createUser(db, "a5-isaac@hui.test", "Isaac Host"),
      jamie: await createUser(db, "a5-jamie@hui.test", "Jamie Member"),
    };

    await asUser(db, ids.owner);
    groupId = (
      await db.query<{ create_group: string }>(`select public.create_group($1) as create_group`, [
        "A5 group",
      ])
    ).rows[0].create_group;

    await db.query(
      `insert into public.group_memberships (group_id, user_id, role)
       values ($1, $2, 'member'), ($1, $3, 'member')`,
      [groupId, ids.isaac, ids.jamie],
    );

    const insertCategory = async (name: string) => {
      const row = await db.query<{ id: string }>(
        `insert into public.contribution_categories (group_id, name)
         values ($1, $2) returning id`,
        [groupId, name],
      );
      return row.rows[0].id;
    };

    dessertCategoryId = await insertCategory("Dessert");
    await insertCategory("Drinks");
    await insertCategory("Salad");
  }, 120_000);

  afterAll(async () => {
    await db?.close();
  });

  it("keeps a Dessert-only hui Dessert-only after the host accepts", async () => {
    await asUser(db, ids.owner);
    const candidates = JSON.stringify([
      {
        starts_at: wallClockToUtcIso("2034-06-01T12:00", "Pacific/Auckland"),
        ends_at: null,
      },
    ]);
    const requests = JSON.stringify([{ category_id: dessertCategoryId, label: "Dessert" }]);
    const eventId = (
      await db.query<{ propose_group_event: string }>(
        `select public.propose_group_event($1, $2, null, null, null, $3::jsonb, false, null, null, null, 'dinner_meal'::public.gathering_type, null, $4::jsonb, false) as propose_group_event`,
        [groupId, "Dessert only", candidates, requests],
      )
    ).rows[0].propose_group_event;

    const candidateId = (
      await db.query<{ id: string }>(
        `select id from public.event_candidates where event_id = $1 limit 1`,
        [eventId],
      )
    ).rows[0].id;

    await asUser(db, ids.isaac);
    await db.query(
      `insert into public.event_responses (candidate_id, user_id, response, visibility)
       values ($1, $2, 'yes', 'group')`,
      [candidateId, ids.isaac],
    );

    await asUser(db, ids.owner);
    await db.query(`select public.propose_event_host_for_event($1, $2)`, [eventId, ids.owner]);

    const proposedId = (
      await db.query<{ user_id: string }>(
        `select user_id::text from public.host_assignments
         where event_id = $1 and status = 'proposed' order by created_at desc limit 1`,
        [eventId],
      )
    ).rows[0]?.user_id;

    await asUser(db, proposedId);
    await db.query(`select public.respond_to_host_assignment($1, true)`, [eventId]);

    const rows = await db.query<{ category_id: string }>(
      `select category_id::text from public.event_contributions where event_id = $1 order by category_id`,
      [eventId],
    );
    expect(rows.rows).toHaveLength(1);
    expect(rows.rows[0].category_id).toBe(dessertCategoryId);
  });

  it("swap with a replacement proposes another host", async () => {
    await asUser(db, ids.owner);
    const event = await db.query<{ id: string }>(
      `insert into public.events (group_id, title, status, created_by)
       values ($1, 'Swap with replacement', 'proposing', $2) returning id`,
      [groupId, ids.owner],
    );
    const eventId = event.rows[0].id;
    const candidate = await db.query<{ id: string }>(
      `insert into public.event_candidates (event_id, starts_at, ends_at, proposed_by)
       values ($1, '2034-07-01T05:00:00Z', '2034-07-01T08:00:00Z', $2) returning id`,
      [eventId, ids.owner],
    );
    const candidateId = candidate.rows[0].id;

    for (const userId of [ids.isaac, ids.jamie]) {
      await asUser(db, userId);
      await db.query(
        `insert into public.event_responses (candidate_id, user_id, response, visibility)
         values ($1, $2, 'yes', 'group')`,
        [candidateId, userId],
      );
    }

    await asUser(db, ids.owner);
    await db.query(`select public.propose_event_host_for_event($1, $2)`, [eventId, ids.owner]);
    const firstHost = (
      await db.query<{ user_id: string }>(
        `select user_id::text from public.host_assignments
         where event_id = $1 and status = 'proposed' order by created_at desc limit 1`,
        [eventId],
      )
    ).rows[0].user_id;

    await asUser(db, firstHost);
    const hasReplacement = await db.query<{ v: boolean }>(
      `select public.host_swap_has_replacement($1) as v`,
      [eventId],
    );
    expect(hasReplacement.rows[0].v).toBe(true);

    await db.query(`select public.request_host_swap($1)`, [eventId]);

    const replacement = await db.query<{ user_id: string }>(
      `select user_id::text from public.host_assignments
       where event_id = $1 and status = 'proposed' order by created_at desc limit 1`,
      [eventId],
    );
    expect(replacement.rows[0]?.user_id).toBeTruthy();
    expect(replacement.rows[0].user_id).not.toBe(firstHost);
  });

  it("request_host_swap function notifies organiser when vacant", async () => {
    const def = await db.query<{ def: string }>(
      `select pg_get_functiondef('public.request_host_swap(uuid)'::regprocedure) as def`,
    );
    expect(def.rows[0].def).toContain("No host for this hui");
  });

  it("swap with no replacement notifies the organiser", async () => {
    await asUser(db, ids.owner);
    await db.query(
      `update public.group_memberships
       set hosting_standing = 'never'
       where group_id = $1 and user_id in ($2, $3)`,
      [groupId, ids.jamie, ids.owner],
    );

    const event = await db.query<{ id: string }>(
      `insert into public.events (group_id, title, status, created_by)
       values ($1, 'Vacant host', 'proposing', $2) returning id`,
      [groupId, ids.owner],
    );
    const eventId = event.rows[0].id;
    const candidate = await db.query<{ id: string }>(
      `insert into public.event_candidates (event_id, starts_at, ends_at, proposed_by)
       values ($1, '2034-08-01T05:00:00Z', '2034-08-01T08:00:00Z', $2) returning id`,
      [eventId, ids.owner],
    );

    await asUser(db, ids.isaac);
    await db.query(
      `insert into public.event_responses (candidate_id, user_id, response, visibility)
       values ($1, $2, 'yes', 'group')`,
      [candidate.rows[0].id, ids.isaac],
    );

    await asUser(db, ids.owner);
    await db.query(`select public.assign_event_host($1, $2)`, [eventId, ids.isaac]);
    await asUser(db, ids.isaac);
    await db.query(`select public.respond_to_host_assignment($1, true)`, [eventId]);

    const createdBy = await db.query<{ created_by: string }>(
      `select created_by::text from public.events where id = $1`,
      [eventId],
    );
    expect(createdBy.rows[0].created_by).toBe(ids.owner);
    expect(createdBy.rows[0].created_by).not.toBe(ids.isaac);

    const preview = await db.query<{ v: boolean }>(
      `select public.host_swap_has_replacement($1) as v`,
      [eventId],
    );
    expect(preview.rows[0].v).toBe(false);

    const swapReturn = await db.query<{ id: string | null }>(
      `select public.request_host_swap($1)::text as id`,
      [eventId],
    );
    expect(swapReturn.rows[0].id ?? null).toBeNull();

    const hostRows = await db.query<{ status: string; user_id: string }>(
      `select status::text, user_id::text from public.host_assignments where event_id = $1 order by created_at`,
      [eventId],
    );
    expect(hostRows.rows.some((row) => row.status === "swapped_out")).toBe(true);

    const pickAfter = await db.query<{ user_id: string | null }>(
      `select public.pick_host_candidate($1, $2)::text as user_id`,
      [groupId, eventId],
    );
    expect(pickAfter.rows[0].user_id ?? null).toBeNull();

    const proposed = await db.query(
      `select 1 from public.host_assignments where event_id = $1 and status = 'proposed'`,
      [eventId],
    );
    expect(proposed.rows).toHaveLength(0);

    await asUser(db, ids.owner);
    const vacant = await db.query<{
      user_id: string;
      kind: string;
      title: string;
      dedupe_key: string;
    }>(
      `select user_id::text, kind::text, title, dedupe_key
       from public.member_notifications
       where dedupe_key = $1`,
      [`host_vacant:${eventId}:${ids.isaac}`],
    );
    expect(vacant.rows).toHaveLength(1);
    expect(vacant.rows[0].user_id).toBe(ids.owner);
    expect(vacant.rows[0].kind).toBe("host_declined");
    expect(vacant.rows[0].title).toBe("No host for this hui");

    await db.query(
      `update public.group_memberships
       set hosting_standing = 'default'
       where group_id = $1`,
      [groupId],
    );
  });
});
