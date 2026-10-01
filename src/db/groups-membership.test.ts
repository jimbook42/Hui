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
  admin: string;
  member: string;
  outsider: string;
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

describe("group creation and membership (HUI-007)", () => {
  beforeAll(async () => {
    db = new PGlite();
    await db.exec(HARNESS_SQL);

    const dir = path.join(process.cwd(), "supabase", "migrations");
    const files = (await readdir(dir)).filter((file) => file.endsWith(".sql")).sort();
    for (const file of files) {
      await db.exec(await readFile(path.join(dir, file), "utf8"));
    }

    ids = {
      owner: await createUser(db, "owner@hui.test", "Olivia Owner"),
      admin: await createUser(db, "admin@hui.test", "Alex Admin"),
      member: await createUser(db, "member@hui.test", "Mia Member"),
      outsider: await createUser(db, "outsider@hui.test", "Omar Outsider"),
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

  it("creates a group with owner membership and default settings atomically", async () => {
    await asUser(db, ids.outsider);
    const created = await db.query<{ create_group: string }>(
      `select public.create_group($1) as create_group`,
      ["Friday friends"],
    );
    const groupId = created.rows[0].create_group;

    const group = await db.query<{ owner_id: string; name: string }>(
      `select owner_id, name from public.groups where id = $1`,
      [groupId],
    );
    const membership = await db.query<{ role: string; status: string }>(
      `select role::text as role, status::text as status
       from public.group_memberships
       where group_id = $1 and user_id = $2`,
      [groupId, ids.outsider],
    );
    const settings = await db.query<{ who_may_propose: string }>(
      `select who_may_propose::text as who_may_propose
       from public.group_settings
       where group_id = $1`,
      [groupId],
    );

    expect(group.rows[0]).toEqual({ owner_id: ids.outsider, name: "Friday friends" });
    expect(membership.rows[0]).toEqual({ role: "owner", status: "active" });
    expect(settings.rows[0].who_may_propose).toBe("any_member");
  });

  it("lists only active memberships for the current member", async () => {
    await asUser(db, ids.owner);
    const groupId = (
      await db.query<{ create_group: string }>(`select public.create_group($1) as create_group`, [
        "List test",
      ])
    ).rows[0].create_group;

    await asUser(db, ids.owner);
    const visible = await db.query<{ id: string }>(
      `select id from public.groups where id = $1`,
      [groupId],
    );
    await asUser(db, ids.outsider);
    const hidden = await db.query(`select id from public.groups where id = $1`, [groupId]);

    expect(visible.rows).toHaveLength(1);
    expect(hidden.rows).toEqual([]);
  });

  it("lets a member leave and blocks access afterwards", async () => {
    await asUser(db, ids.owner);
    const groupId = (
      await db.query<{ create_group: string }>(`select public.create_group($1) as create_group`, [
        "Leavers",
      ])
    ).rows[0].create_group;
    await db.query(
      `insert into public.group_memberships (group_id, user_id, role)
       values ($1, $2, 'member')`,
      [groupId, ids.member],
    );

    await asUser(db, ids.member);
    await db.query(`select public.leave_group($1)`, [groupId]);

    const ownMembership = await db.query<{ status: string }>(
      `select status::text as status
       from public.group_memberships
       where group_id = $1 and user_id = $2`,
      [groupId, ids.member],
    );
    const hiddenGroup = await db.query(`select id from public.groups where id = $1`, [groupId]);

    expect(ownMembership.rows[0].status).toBe("removed");
    expect(hiddenGroup.rows).toEqual([]);
  });

  it("prevents the owner from leaving without transferring ownership", async () => {
    await asUser(db, ids.owner);
    const groupId = (
      await db.query<{ create_group: string }>(`select public.create_group($1) as create_group`, [
        "Owner stay",
      ])
    ).rows[0].create_group;

    const error = await expectFail(() => db.query(`select public.leave_group($1)`, [groupId]));
    expect(error).toMatch(/transfer ownership before leaving/);
  });

  it("preserves removed membership history while revoking current access", async () => {
    await asUser(db, ids.owner);
    const groupId = (
      await db.query<{ create_group: string }>(`select public.create_group($1) as create_group`, [
        "History",
      ])
    ).rows[0].create_group;
    await db.query(
      `insert into public.group_memberships (group_id, user_id, role)
       values ($1, $2, 'member')`,
      [groupId, ids.member],
    );

    await asUser(db, ids.owner);
    await db.query(
      `update public.group_memberships
       set status = 'removed'
       where group_id = $1 and user_id = $2`,
      [groupId, ids.member],
    );

    await asUser(db, ids.member);
    const hidden = await db.query(`select id from public.groups where id = $1`, [groupId]);

    await asUser(db, null);
    const history = await db.query<{ status: string }>(
      `select status::text as status
       from public.group_memberships
       where group_id = $1 and user_id = $2`,
      [groupId, ids.member],
    );

    expect(hidden.rows).toEqual([]);
    expect(history.rows[0].status).toBe("removed");
  });

  it("restricts settings updates and ownership transfer to authorised roles", async () => {
    await asUser(db, ids.owner);
    const groupId = (
      await db.query<{ create_group: string }>(`select public.create_group($1) as create_group`, [
        "Rules",
      ])
    ).rows[0].create_group;
    await db.query(
      `insert into public.group_memberships (group_id, user_id, role)
       values ($1, $2, 'member')`,
      [groupId, ids.member],
    );

    await asUser(db, ids.member);
    const blockedSettings = await db.query(
      `update public.group_settings set minimum_attendees = 9 where group_id = $1 returning group_id`,
      [groupId],
    );
    const blockedTransfer = await expectFail(() =>
      db.query(`select public.transfer_group_ownership($1, $2)`, [groupId, ids.member]),
    );

    await asUser(db, ids.owner);
    await db.query(`select public.transfer_group_ownership($1, $2)`, [groupId, ids.member]);

    await asUser(db, null);
    const ownerRow = await db.query<{ user_id: string; owner_id: string }>(
      `select m.user_id, g.owner_id
       from public.group_memberships m
       join public.groups g on g.id = m.group_id
       where m.group_id = $1 and m.role = 'owner' and m.status = 'active'`,
      [groupId],
    );

    expect(blockedSettings.rows).toEqual([]);
    expect(blockedTransfer).toMatch(/only the owner can transfer ownership/);
    expect(ownerRow.rows[0]).toEqual({ user_id: ids.member, owner_id: ids.member });
  });
});
