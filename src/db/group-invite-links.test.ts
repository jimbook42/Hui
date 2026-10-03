import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { PGlite } from "@electric-sql/pglite";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { buildGroupInviteUrl, inviteUrlContainsNoGroupId } from "@/domain/invites/urls";

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

async function asUser(database: PGlite, userId: string | null, role: "anon" | "authenticated" = "authenticated") {
  await database.exec("reset role");
  await database.query(`select set_config('request.jwt.claim.sub', $1, false)`, [
    userId ?? "",
  ]);
  if (userId) {
    await database.exec(`set role ${role}`);
  } else if (role === "anon") {
    await database.exec("set role anon");
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

function parseJson<T extends Record<string, unknown>>(value: unknown): T {
  if (typeof value === "string") {
    return JSON.parse(value) as T;
  }
  return value as T;
}

describe("group invite links (HUI-022B)", () => {
  beforeAll(async () => {
    db = new PGlite();
    await db.exec(HARNESS_SQL);

    const dir = path.join(process.cwd(), "supabase", "migrations");
    const files = (await readdir(dir)).filter((file) => file.endsWith(".sql")).sort();
    for (const file of files) {
      await db.exec(await readFile(path.join(dir, file), "utf8"));
    }

    ids = {
      owner: await createUser(db, "owner-inv@hui.test", "Olivia Owner"),
      admin: await createUser(db, "admin-inv@hui.test", "Alex Admin"),
      member: await createUser(db, "member-inv@hui.test", "Mia Member"),
      outsider: await createUser(db, "outsider-inv@hui.test", "Omar Outsider"),
    };

    await asUser(db, ids.owner);
    groupId = (
      await db.query<{ create_group: string }>(`select public.create_group($1) as create_group`, [
        "Invite testers",
      ])
    ).rows[0].create_group;

    await db.query(
      `insert into public.group_memberships (group_id, user_id, role)
       values ($1, $2, 'admin'), ($1, $3, 'member')`,
      [groupId, ids.admin, ids.member],
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

  it("generates unpredictable tokens without group ids in the public URL", async () => {
    await asUser(db, ids.owner);
    const first = (
      await db.query<{ get_group_invite_link: string }>(
        `select public.get_group_invite_link($1) as get_group_invite_link`,
        [groupId],
      )
    ).rows[0].get_group_invite_link;

    const second = (
      await db.query<{ regenerate_group_invite_link: string }>(
        `select public.regenerate_group_invite_link($1) as regenerate_group_invite_link`,
        [groupId],
      )
    ).rows[0].regenerate_group_invite_link;

    expect(first).not.toEqual(second);
    expect(first.length).toBeGreaterThanOrEqual(32);
    const url = buildGroupInviteUrl("https://hui.example", first);
    expect(inviteUrlContainsNoGroupId(url, groupId)).toBe(true);
    expect(url).toMatch(/^https:\/\/hui\.example\/join\//);
  });

  it("allows admins to fetch or create a link and blocks outsiders", async () => {
    await asUser(db, ids.admin);
    const token = (
      await db.query<{ get_group_invite_link: string }>(
        `select public.get_group_invite_link($1) as get_group_invite_link`,
        [groupId],
      )
    ).rows[0].get_group_invite_link;
    expect(token.length).toBeGreaterThan(0);

    await asUser(db, ids.member);
    const denied = await expectFail(() =>
      db.query(`select public.get_group_invite_link($1)`, [groupId]),
    );
    expect(denied).toMatch(/not authorised/);

    await asUser(db, ids.outsider);
    const outsiderDenied = await expectFail(() =>
      db.query(`select public.get_group_invite_link($1)`, [groupId]),
    );
    expect(outsiderDenied).toMatch(/not authorised/);
  });

  it("resolves valid tokens and hides data for invalid or revoked tokens", async () => {
    await asUser(db, ids.owner);
    const token = (
      await db.query<{ regenerate_group_invite_link: string }>(
        `select public.regenerate_group_invite_link($1) as regenerate_group_invite_link`,
        [groupId],
      )
    ).rows[0].regenerate_group_invite_link;

    await asUser(db, null, "anon");
    const valid = parseJson<{ status: string; groupName?: string }>(
      (
        await db.query<{ resolve_group_invite: unknown }>(
          `select public.resolve_group_invite($1) as resolve_group_invite`,
          [token],
        )
      ).rows[0].resolve_group_invite,
    );
    expect(valid.status).toBe("valid");
    expect(valid.groupName).toBe("Invite testers");

    const invalid = parseJson<{ status: string; groupName?: string }>(
      (
        await db.query<{ resolve_group_invite: unknown }>(
          `select public.resolve_group_invite($1) as resolve_group_invite`,
          ["not-a-real-token"],
        )
      ).rows[0].resolve_group_invite,
    );
    expect(invalid).toEqual({ status: "invalid" });
    expect(invalid.groupName).toBeUndefined();

    await asUser(db, ids.owner);
    const newToken = (
      await db.query<{ regenerate_group_invite_link: string }>(
        `select public.regenerate_group_invite_link($1) as regenerate_group_invite_link`,
        [groupId],
      )
    ).rows[0].regenerate_group_invite_link;

    await asUser(db, null, "anon");
    const old = parseJson<{ status: string }>(
      (
        await db.query<{ resolve_group_invite: unknown }>(
          `select public.resolve_group_invite($1) as resolve_group_invite`,
          [token],
        )
      ).rows[0].resolve_group_invite,
    );
    expect(old.status).toBe("invalid");

    const fresh = parseJson<{ status: string }>(
      (
        await db.query<{ resolve_group_invite: unknown }>(
          `select public.resolve_group_invite($1) as resolve_group_invite`,
          [newToken],
        )
      ).rows[0].resolve_group_invite,
    );
    expect(fresh.status).toBe("valid");
  });

  it("rejects invalid join tokens and blocks direct membership inserts", async () => {
    await asUser(db, ids.outsider);
    const invalid = parseJson<{ status: string }>(
      (
        await db.query<{ join_group_via_invite: unknown }>(
          `select public.join_group_via_invite($1) as join_group_via_invite`,
          ["not-a-valid-invite-token"],
        )
      ).rows[0].join_group_via_invite,
    );
    expect(invalid).toEqual({ status: "invalid" });

    await asUser(db, ids.owner);
    const otherGroup = (
      await db.query<{ create_group: string }>(`select public.create_group($1) as create_group`, [
        "No direct insert",
      ])
    ).rows[0].create_group;

    await asUser(db, ids.outsider);
    const blocked = await expectFail(() =>
      db.query(
        `insert into public.group_memberships (group_id, user_id, role)
         values ($1, $2, 'member') returning id`,
        [otherGroup, ids.outsider],
      ),
    );
    expect(blocked).toMatch(/row-level security policy/);
  });

  it("reports already_member on resolve for active members", async () => {
    await asUser(db, ids.owner);
    const token = (
      await db.query<{ get_group_invite_link: string }>(
        `select public.get_group_invite_link($1) as get_group_invite_link`,
        [groupId],
      )
    ).rows[0].get_group_invite_link;

    await asUser(db, ids.member);
    const resolved = parseJson<{ status: string; groupId: string }>(
      (
        await db.query<{ resolve_group_invite: unknown }>(
          `select public.resolve_group_invite($1) as resolve_group_invite`,
          [token],
        )
      ).rows[0].resolve_group_invite,
    );
    expect(resolved.status).toBe("already_member");
    expect(resolved.groupId).toBe(groupId);
  });

  it("blocks non-admins from regenerating links", async () => {
    await asUser(db, ids.member);
    const denied = await expectFail(() =>
      db.query(`select public.regenerate_group_invite_link($1)`, [groupId]),
    );
    expect(denied).toMatch(/not authorised/);
  });

  it("joins via token using auth.uid() only and is idempotent", async () => {
    await asUser(db, ids.owner);
    const token = (
      await db.query<{ get_group_invite_link: string }>(
        `select public.get_group_invite_link($1) as get_group_invite_link`,
        [groupId],
      )
    ).rows[0].get_group_invite_link;

    await asUser(db, ids.outsider);
    const joined = parseJson<{ status: string; groupId: string }>(
      (
        await db.query<{ join_group_via_invite: unknown }>(
          `select public.join_group_via_invite($1) as join_group_via_invite`,
          [token],
        )
      ).rows[0].join_group_via_invite,
    );
    expect(joined).toEqual({ status: "joined", groupId });

    const again = parseJson<{ status: string; groupId: string }>(
      (
        await db.query<{ join_group_via_invite: unknown }>(
          `select public.join_group_via_invite($1) as join_group_via_invite`,
          [token],
        )
      ).rows[0].join_group_via_invite,
    );
    expect(again).toEqual({ status: "already_member", groupId });
  });

  it("enforces RPC execute privileges and blocks direct invite table reads", async () => {
    await asUser(db, ids.owner);
    const token = (
      await db.query<{ get_group_invite_link: string }>(
        `select public.get_group_invite_link($1) as get_group_invite_link`,
        [groupId],
      )
    ).rows[0].get_group_invite_link;

    await asUser(db, null, "anon");
    const anonResolve = parseJson<{ status: string }>(
      (
        await db.query<{ resolve_group_invite: unknown }>(
          `select public.resolve_group_invite($1) as resolve_group_invite`,
          [token],
        )
      ).rows[0].resolve_group_invite,
    );
    expect(anonResolve.status).toBe("valid");

    const anonGetLink = await expectFail(() =>
      db.query(`select public.get_group_invite_link($1)`, [groupId]),
    );
    expect(anonGetLink).toMatch(/permission denied|not authenticated/i);

    const anonJoin = await expectFail(() =>
      db.query(`select public.join_group_via_invite($1)`, [token]),
    );
    expect(anonJoin).toMatch(/permission denied|not authenticated/i);

    const internalHelper = await expectFail(() =>
      db.query(`select public._active_group_invite_row($1)`, [token]),
    );
    expect(internalHelper).toMatch(/permission denied/i);

    await asUser(db, ids.admin);
    const directRead = await expectFail(() =>
      db.query(`select token from public.group_invite_links where group_id = $1`, [groupId]),
    );
    expect(directRead).toMatch(/permission denied|row-level security/i);
  });
});
