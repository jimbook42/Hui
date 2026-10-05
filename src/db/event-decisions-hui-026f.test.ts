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

async function createDecision(optionLabels: string[] = ["A", "B"]) {
  await asUser(db, ids.owner);
  const decisionId = (
    await db.query<{ create_event_decision: string }>(
      `select public.create_event_decision($1, $2, $3) as create_event_decision`,
      [eventId, "Where should we eat?", optionLabels],
    )
  ).rows[0].create_event_decision;

  const options = await db.query<{ id: string; label: string }>(
    `select id, label from public.event_decision_options where decision_id = $1 order by position`,
    [decisionId],
  );
  return { decisionId, options: options.rows };
}

describe("event decisions HUI-026F", () => {
  beforeAll(async () => {
    db = new PGlite();
    await db.exec(HARNESS_SQL);

    const dir = path.join(process.cwd(), "supabase", "migrations");
    const files = (await readdir(dir)).filter((file) => file.endsWith(".sql")).sort();
    for (const file of files) {
      await db.exec(await readFile(path.join(dir, file), "utf8"));
    }

    ids = {
      owner: await createUser(db, "026f-owner@hui.test", "Olivia Owner"),
      member: await createUser(db, "026f-member@hui.test", "Mia Member"),
      outsider: await createUser(db, "026f-out@hui.test", "Otto Outsider"),
    };

    await asUser(db, ids.owner);
    groupId = (
      await db.query<{ create_group: string }>(`select public.create_group($1) as create_group`, [
        "026F group",
      ])
    ).rows[0].create_group;

    await db.query(
      `insert into public.group_memberships (group_id, user_id, role) values ($1, $2, 'member')`,
      [groupId, ids.member],
    );

    eventId = (
      await db.query<{ id: string }>(
        `insert into public.events (group_id, title, status, created_by)
         values ($1, 'Dinner', 'proposing', $2) returning id`,
        [groupId, ids.owner],
      )
    ).rows[0].id;
  }, 90_000);

  afterEach(async () => {
    if (db) {
      await asUser(db, null);
    }
  });

  afterAll(async () => {
    await db?.close();
  });

  it("creates a decision with at least two options", async () => {
    const { decisionId, options } = await createDecision();
    expect(options).toHaveLength(2);
    const row = await db.query<{ question: string; status: string }>(
      `select question, status::text from public.event_decisions where id = $1`,
      [decisionId],
    );
    expect(row.rows[0]).toMatchObject({ question: "Where should we eat?", status: "open" });
  });

  it("rejects fewer than two options", async () => {
    await asUser(db, ids.owner);
    const error = await expectFail(() =>
      db.query(`select public.create_event_decision($1, $2, $3)`, [
        eventId,
        "One option only?",
        ["Solo"],
      ]),
    );
    expect(error).toMatch(/at least two options/i);
  });

  it("lets members read and respond, and change their response", async () => {
    const { decisionId, options } = await createDecision(["Kitchen", "Home"]);
    await asUser(db, ids.member);
    await db.query(`select public.respond_event_decision($1, $2)`, [decisionId, options[0].id]);

    let tally = await db.query<{ count: string }>(
      `select count(*)::text as count from public.event_decision_responses where decision_id = $1 and option_id = $2`,
      [decisionId, options[0].id],
    );
    expect(Number(tally.rows[0].count)).toBe(1);

    await db.query(`select public.respond_event_decision($1, $2)`, [decisionId, options[1].id]);
    tally = await db.query<{ count: string }>(
      `select count(*)::text as count from public.event_decision_responses where decision_id = $1`,
      [decisionId],
    );
    expect(Number(tally.rows[0].count)).toBe(1);
  });

  it("does not auto-select on ties when finalising a specific option", async () => {
    const { decisionId, options } = await createDecision();
    await asUser(db, ids.member);
    await db.query(`select public.respond_event_decision($1, $2)`, [decisionId, options[0].id]);
    await asUser(db, ids.owner);
    await db.query(`select public.respond_event_decision($1, $2)`, [decisionId, options[1].id]);

    await db.query(`select public.finalize_event_decision($1, $2)`, [decisionId, options[0].id]);
    const row = await db.query<{ status: string; selected_option_id: string }>(
      `select status::text, selected_option_id from public.event_decisions where id = $1`,
      [decisionId],
    );
    expect(row.rows[0].status).toBe("decided");
    expect(row.rows[0].selected_option_id).toBe(options[0].id);
  });

  it("blocks members from finalising and outsiders from reading or responding", async () => {
    const { decisionId, options } = await createDecision();

    await asUser(db, ids.member);
    const deniedFinalize = await expectFail(() =>
      db.query(`select public.finalize_event_decision($1, $2)`, [decisionId, options[0].id]),
    );
    expect(deniedFinalize).toMatch(/not allowed/i);

    await asUser(db, ids.outsider);
    const hidden = await db.query(`select id from public.event_decisions where id = $1`, [decisionId]);
    expect(hidden.rows).toHaveLength(0);

    const deniedRespond = await expectFail(() =>
      db.query(`select public.respond_event_decision($1, $2)`, [decisionId, options[0].id]),
    );
    expect(deniedRespond).toMatch(/not an active group member/i);
  });

  it("blocks anonymous mutations", async () => {
    const { decisionId, options } = await createDecision();
    await asUser(db, null);
    const error = await expectFail(() =>
      db.query(`select public.respond_event_decision($1, $2)`, [decisionId, options[0].id]),
    );
    expect(error).toMatch(/not authenticated/i);
  });

  it("cancels open decisions and blocks new responses", async () => {
    const { decisionId, options } = await createDecision();
    await asUser(db, ids.owner);
    await db.query(`select public.cancel_event_decision($1)`, [decisionId]);

    await asUser(db, ids.member);
    const error = await expectFail(() =>
      db.query(`select public.respond_event_decision($1, $2)`, [decisionId, options[0].id]),
    );
    expect(error).toMatch(/no longer open/i);
  });

  it("blocks editing after responses exist", async () => {
    const { decisionId, options } = await createDecision();
    await asUser(db, ids.member);
    await db.query(`select public.respond_event_decision($1, $2)`, [decisionId, options[0].id]);

    await asUser(db, ids.owner);
    const error = await expectFail(() =>
      db.query(`select public.update_event_decision_draft($1, $2, $3)`, [
        decisionId,
        "New question?",
        ["X", "Y"],
      ]),
    );
    expect(error).toMatch(/after members have responded/i);
  });
});
