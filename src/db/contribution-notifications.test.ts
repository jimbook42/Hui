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
  bob: string;
  tim: string;
  phil: string;
};

let db: PGlite;
let ids: Ids;
let groupId: string;
let eventId: string;
let sideId: string;
let dessertId: string;

async function asUser(database: PGlite, userId: string | null, role = "authenticated") {
  await database.exec("reset role");
  await database.query(`select set_config('request.jwt.claim.sub', $1, false)`, [userId ?? ""]);
  if (userId) {
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

async function countContributionPushOutbox(): Promise<number> {
  await asUser(db, null, "service_role");
  const rows = await db.query<{ count: string }>(
    `select count(*)::text as count
     from public.notification_push_outbox o
     join public.member_notifications n on n.id = o.notification_id
     where n.kind = 'contribution_changed'`,
  );
  return Number(rows.rows[0].count);
}

async function contributionIdForCategory(categoryId: string): Promise<string> {
  const row = await db.query<{ id: string }>(
    `select id from public.event_contributions
     where event_id = $1 and category_id = $2
     order by created_at desc
     limit 1`,
    [eventId, categoryId],
  );
  return row.rows[0].id;
}

describe("contribution notification policy", () => {
  beforeAll(async () => {
    db = new PGlite();
    await db.exec(HARNESS_SQL);

    const dir = path.join(process.cwd(), "supabase", "migrations");
    const files = (await readdir(dir)).filter((file) => file.endsWith(".sql")).sort();
    for (const file of files) {
      await db.exec(await readFile(path.join(dir, file), "utf8"));
    }

    ids = {
      bob: await createUser(db, "bob@hui.test", "Bob"),
      tim: await createUser(db, "tim@hui.test", "Tim"),
      phil: await createUser(db, "phil@hui.test", "Phil"),
    };

    await asUser(db, ids.bob);
    groupId = (
      await db.query<{ create_group: string }>(`select public.create_group($1) as create_group`, [
        "Potluck pals",
      ])
    ).rows[0].create_group;

    await db.query(
      `insert into public.group_memberships (group_id, user_id, role) values ($1, $2, 'member'), ($1, $3, 'member')`,
      [groupId, ids.tim, ids.phil],
    );

    sideId = (
      await db.query<{ id: string }>(
        `insert into public.contribution_categories (group_id, name) values ($1, 'Side') returning id`,
        [groupId],
      )
    ).rows[0].id;

    dessertId = (
      await db.query<{ id: string }>(
        `insert into public.contribution_categories (group_id, name) values ($1, 'Dessert') returning id`,
        [groupId],
      )
    ).rows[0].id;

    eventId = (
      await db.query<{ id: string }>(
        `insert into public.events (group_id, title, status, created_by)
         values ($1, 'Sunday lunch', 'proposing', $2) returning id`,
        [groupId, ids.bob],
      )
    ).rows[0].id;

    await db.query(
      `insert into public.event_contributions (event_id, group_id, category_id, user_id, label, status, assigned_by)
       values ($1, $2, $3, null, 'Side', 'open', $4),
              ($1, $2, $5, null, 'Dessert', 'open', $4)`,
      [eventId, groupId, sideId, ids.bob, dessertId],
    );

    await asUser(db, null);
    for (const userId of [ids.bob, ids.tim, ids.phil]) {
      await db.query(
        `update public.profiles
         set web_push_enabled = true, push_contribution_changes_enabled = true
         where id = $1`,
        [userId],
      );
    }
  }, 90_000);

  afterEach(async () => {
    if (db) {
      await asUser(db, null);
    }
  });

  afterAll(async () => {
    await db?.close();
  });

  it("records member claim for coordinators without Web Push", async () => {
    await asUser(db, ids.tim);
    await db.query(`select public.claim_event_contribution($1, $2, $3)`, [
      eventId,
      sideId,
      "Potato salad",
    ]);

    await asUser(db, ids.bob);
    const notes = await db.query<{ body: string }>(
      `select body from public.member_notifications
       where user_id = $1 and event_id = $2 and kind = 'contribution_changed'`,
      [ids.bob, eventId],
    );
    expect(notes.rows.length).toBeGreaterThanOrEqual(1);
    expect(notes.rows.some((row) => /claimed/i.test(row.body))).toBe(true);

    expect(await countContributionPushOutbox()).toBe(0);
  });

  it("records member release for coordinators without Web Push", async () => {
    await asUser(db, ids.tim);
    const contributionId = await contributionIdForCategory(sideId);
    await db.query(`select public.release_event_contribution($1)`, [contributionId]);

    await asUser(db, ids.bob);
    const notes = await db.query(
      `select 1 from public.member_notifications
       where user_id = $1 and event_id = $2 and body like '%released%'`,
      [ids.bob, eventId],
    );
    expect(notes.rows.length).toBeGreaterThanOrEqual(1);
    expect(await countContributionPushOutbox()).toBe(0);
  });

  it("pushes only the assignee on manager assignment, not the whole group", async () => {
    await asUser(db, ids.bob);
    await db.query(`select public.assign_event_contribution_as_manager($1, $2, $3, null)`, [
      eventId,
      dessertId,
      ids.tim,
    ]);

    await asUser(db, null, "service_role");
    const pushes = await db.query<{ user_id: string }>(
      `select o.user_id
       from public.notification_push_outbox o
       join public.member_notifications n on n.id = o.notification_id
       where n.event_id = $1 and n.kind = 'contribution_changed'`,
      [eventId],
    );
    expect(pushes.rows).toHaveLength(1);
    expect(pushes.rows[0].user_id).toBe(ids.tim);

    await asUser(db, ids.phil);
    const philContributionNotes = await db.query(
      `select 1 from public.member_notifications
       where user_id = $1 and event_id = $2 and kind = 'contribution_changed'`,
      [ids.phil, eventId],
    );
    expect(philContributionNotes.rows).toHaveLength(0);
  });

  it("does not push on manager clear and coalesces reassignment pushes", async () => {
    await asUser(db, ids.bob);
    let dessertContributionId = await contributionIdForCategory(dessertId);

    await db.query(`select public.reassign_event_contribution_as_manager($1, $2, null)`, [
      dessertContributionId,
      ids.phil,
    ]);

    dessertContributionId = await contributionIdForCategory(dessertId);
    await db.query(`select public.release_event_contribution_as_manager($1)`, [
      dessertContributionId,
    ]);

    await asUser(db, null, "service_role");
    const pushes = await db.query(
      `select o.id
       from public.notification_push_outbox o
       join public.member_notifications n on n.id = o.notification_id
       where n.event_id = $1 and n.kind = 'contribution_changed'`,
      [eventId],
    );
    expect(pushes.rows).toHaveLength(1);
  });

  it("does not emit six pushes for the production-style rapid sequence", async () => {
    await asUser(db, null);
    await db.query(`delete from public.notification_push_outbox`);
    await db.query(
      `delete from public.member_notifications where event_id = $1`,
      [eventId],
    );
    await db.query(`delete from public.event_contributions where event_id = $1`, [eventId]);
    await db.query(
      `insert into public.event_contributions (event_id, group_id, category_id, user_id, label, status, assigned_by)
       values ($1, $2, $3, null, 'Side', 'open', $4),
              ($1, $2, $5, null, 'Dessert', 'open', $4)`,
      [eventId, groupId, sideId, ids.bob, dessertId],
    );

    await asUser(db, ids.tim);
    await db.query(`select public.claim_event_contribution($1, $2, $3)`, [
      eventId,
      sideId,
      "Side dish",
    ]);
    const sideContributionId = await contributionIdForCategory(sideId);
    await db.query(`select public.release_event_contribution($1)`, [sideContributionId]);

    await asUser(db, ids.bob);
    await db.query(`select public.assign_event_contribution_as_manager($1, $2, $3, null)`, [
      eventId,
      dessertId,
      ids.tim,
    ]);
    let dessertContributionId = await contributionIdForCategory(dessertId);
    await db.query(`select public.reassign_event_contribution_as_manager($1, $2, null)`, [
      dessertContributionId,
      ids.phil,
    ]);
    dessertContributionId = await contributionIdForCategory(dessertId);
    await db.query(`select public.release_event_contribution_as_manager($1)`, [
      dessertContributionId,
    ]);

    const pushCount = await countContributionPushOutbox();
    expect(pushCount).toBeLessThanOrEqual(1);

    const duplicateBodies = await db.query<{ body: string; count: string }>(
      `select n.body, count(*)::text as count
       from public.notification_push_outbox o
       join public.member_notifications n on n.id = o.notification_id
       where n.event_id = $1
       group by n.body
       having count(*) > 1`,
      [eventId],
    );
    expect(duplicateBodies.rows).toHaveLength(0);
  });
});
