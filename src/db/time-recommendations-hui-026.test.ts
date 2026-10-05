import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { rankTimeRecommendations } from "@/domain/scheduling/time-recommendations";

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

async function asUser(database: PGlite, userId: string | null) {
  await database.exec("reset role");
  await database.query(`select set_config('request.jwt.claim.sub', $1, false)`, [userId ?? ""]);
  if (userId) {
    await database.exec("set role authenticated");
  }
}

async function createUser(database: PGlite, email: string) {
  await asUser(database, null);
  const created = await database.query<{ id: string }>(
    `insert into auth.users (email) values ($1) returning id`,
    [email],
  );
  return created.rows[0].id;
}

describe("HUI-026 time recommendations privacy", () => {
  beforeAll(
    async () => {
      db = new PGlite();
      await db.exec(HARNESS_SQL);
      const dir = path.join(process.cwd(), "supabase", "migrations");
      const files = (await readdir(dir)).filter((file) => file.endsWith(".sql")).sort();
      for (const file of files) {
        const sql = await readFile(path.join(dir, file), "utf8");
        await db.exec(sql);
      }
    },
    120_000,
  );

  afterAll(async () => {
    await db.close();
  });

  it("keeps standing availability owner-private (RLS)", async () => {
    const owner = await createUser(db, "rec-owner@hui.test");
    const member = await createUser(db, "rec-member@hui.test");
    const outsider = await createUser(db, "rec-out@hui.test");

    await asUser(db, owner);
    const groupId = (
      await db.query<{ create_group: string }>(`select public.create_group($1) as create_group`, [
        "Rec group",
      ])
    ).rows[0].create_group;

    await db.query(
      `insert into public.group_memberships (group_id, user_id, role) values ($1, $2, 'member')`,
      [groupId, member],
    );

    await asUser(db, member);
    await db.query(
      `insert into public.group_member_standing_availability (
         group_id, user_id, day_of_week, start_minute, end_minute, kind
       ) values ($1, $2, 4, 1020, 1320, 'usually_available')`,
      [groupId, member],
    );

    await asUser(db, owner);
    const peerRead = await db.query<{ count: number }>(
      `select count(*)::int as count from public.group_member_standing_availability where group_id = $1`,
      [groupId],
    );
    expect(peerRead.rows[0]?.count).toBe(0);

    await asUser(db, outsider);
    const outsiderRead = await db.query<{ count: number }>(
      `select count(*)::int as count from public.group_member_standing_availability where group_id = $1`,
      [groupId],
    );
    expect(outsiderRead.rows[0]?.count).toBe(0);

    await asUser(db, member);
    const ownRead = await db.query<{ count: number }>(
      `select count(*)::int as count from public.group_member_standing_availability where user_id = $1`,
      [member],
    );
    expect(ownRead.rows[0]?.count).toBe(1);
  });

  it("domain ranking output stays aggregate-only", () => {
    const recommendations = rankTimeRecommendations({
      memberCount: 1,
      members: [
        {
          userId: "00000000-0000-0000-0000-000000000099",
          standingWindows: [
            {
              id: "w1",
              groupId: "g",
              dayOfWeek: 4,
              startMinute: 1020,
              endMinute: 1320,
              kind: "usually_available",
            },
          ],
        },
      ],
      timeZone: "Pacific/Auckland",
      planningTargetDate: "2026-10-15",
      todayDateOnly: "2026-10-01",
      existingCandidates: [],
      maybeResponsesEnabled: true,
    });
    expect(JSON.stringify(recommendations)).not.toContain("00000000-0000-0000-0000-000000000099");
    expect(JSON.stringify(recommendations)).not.toContain("standingWindows");
  });
});
