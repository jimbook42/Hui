# HANDOVER: Hui

This file is self-contained: Part A is the shared process (same in every repo) and Part B is this project. No secrets are included.

# Part B: Hui

## Snapshot (17 Oct 2026)
- **What:** a mobile-first PWA for small groups planning recurring gatherings (Next.js, Supabase).
- **Repo:** `jimbook42/Hui` (public). Base and production branch: `main`. Each ticket gets its own branch off main (`cursor/<ticket>` or `qa/<ticket>`).
- **Live:** https://huiapp.vercel.app (primary). Older aliases: hui-seven-gamma.vercel.app, hui-jimbook.vercel.app. Vercel project `hui` (team jimbook), region **syd1**. `main` auto-deploys to production.
- **Prod:** **v0.18.16** @ main **`f5a9b65`** (PR #58).
- **In flight:** **v0.18.17** on branch **`qa/v0.18.17`** — claim/release push to host/organiser, notification settings copy, member Questions row, What's new banner, invite access note. Draft PR (see below).
- **Pending prod approval:** migration **`20261017180000_hui_v01817_contribution_claim_push.sql`** — extends `notify_contribution_coordination` so member claim/release can Web Push the accepted host (or event creator if no host), rate-limited via `contribution_event_push_recently`; in-app coordinator notifications unchanged. **NOT applied** to live Supabase until Isaac approves.
- **Rollback points:**
  - v0.18.16 `f5a9b65` (previous `a4542f3`)
  - v0.18.12 `a31f6e4`
  - v0.18.11 `62948e4`
  - v0.18.10 `b6d9ffd`
  - tag `automation-start/2026-10-13/hui` → `731d64e`
  - Every Vercel prior-prod deployment is listed in the PM state.md.
  - DB migrations don't roll back.

## Docs
- **In the repo:** `ROADMAP.md`, `WORKLOG.md`, `DECISIONS.md`, `TODO.md`, `AGENTS.md`, `docs/PRODUCT.md`, `docs/HANDOVER.md` (this file), `ARCHITECTURE.md`, `DATA_MODEL.md`, `DESIGN_SYSTEM.md`, `RELEASING.md`, `PROJECT_NOTES.md`, `lifecycle.md`.
- **Design doc / GDD:** in Isaac's Google Drive (Hui folder).
- **QA test accounts:** Drive "Test Accounts.txt". Not copied here.

## Stack and commands
- Next.js + TypeScript, Supabase (auth, Postgres + RLS), Serwist PWA / Web Push, MapLibre. Vitest, Playwright.
- `npm run lint`, `npm run typecheck`, `npm test` (vitest run), `npm run test:e2e` (Playwright), `npm run build`, `npm run validate` (all of these).
- On the box: `/workspace/bin/box-test-slot npx vitest run --maxWorkers=2` (Hui is capped at **2 workers**), `/workspace/bin/box-test-slot --build npm run build`.
- **Never start preview/dev servers inside the test lock** — start servers outside the lock; lock only builds and test runs.
- **Crons** (`vercel.json`): `/api/internal/push/drain` at 08:15 UTC and `/api/internal/planning-cycle/cron` at 08:30 UTC (9:30pm NZDT).
- **Env var names** (values live in Vercel only): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `HUI_GEOCODING_*`, `CRON_SECRET`, `VAPID_*`, `NEXT_PUBLIC_HUI_HOUSEHOLDS_ENABLED` (optional; off when unset).

## Project-specific rules
- **One Supabase project only:** local builds and previews hit the **live** database. QA uses only its test accounts and disposable groups, and creates no junk data. Anything touching auth or the DB is tested on a `qa/<ticket>` preview.
- **Supabase is read-only** unless Isaac approves a specific migration. After approval, the PM applies it through the connector with a pre-check and a check afterwards. Recorded migration versions can differ from repo filenames; note both.
- **Hard gates:** recurrence, host, availability, contribution or confirmation rules; reintroducing email, calendar sync, memories, chat or a native app; new services or costs.
- **Non-negotiables:**
  - mobile-first and low friction
  - a group = recurring people; a gathering = one event
  - `starts_on` is the cadence anchor
  - `planning_target_date` is not a confirmed time
  - responses are independent per candidate
  - hosting is opt-in only
  - preserve user data and respect RLS
- **Deleted accounts:** past hui show "Former member" / "Hosted by Former member". On upcoming hui the host spot is freed (Isaac, 16 Oct).
- **Tickets via the connector:** the Cursor token can't create PRs (403), so the PM opens draft PRs through the GitHub connector.
- **Same-SHA pushes:** pushing a SHA that's already deployed to `qa/*` doesn't redeploy (Vercel dedupe). A preview then needs an API deploy through Cursor.

## Open issues / next
1. **v0.18.17:** Apply migration after Isaac OK; QA claim/release push on preview; Isaac checks notification settings + What's new + invite copy; merge when approved.
2. **Final full prod QA** on production build after merge.
3. **Beta** — limited real-group release.
4. **Hardening list** (parallel / post-beta): lock-order deadlock risk (finalise_event vs auto-confirm trigger); test-only GUC `hui.skip_auto_confirm` in prod; slow confirm/swap (10–20s); pre-existing `/serwist/sw.js` trim TypeError; calendar export polish; migration version mismatches to tidy (e.g. 003A, auto_confirm).

## QA checklist (Hui QA)
1. Test the exact SHA: a local production build (footer shows `v<ver> · <sha7>`), or the `qa/<ticket>` preview for auth/DB work.
2. Retest the ticket's `QA:` items, then a 2-minute smoke test: sign in, dashboard, open a hui, respond to a candidate, organiser manage page, /privacy.
3. Use only the test accounts; keep data in disposable groups.
4. Check mobile width (~390–412px), the console for errors (React #418 etc.), and loading time on actions.
5. Give a verdict line plus one line per finding, sent to Hui PM only. Mark anything skipped NOT TESTED.
6. Start servers outside the test lock; kill them by PID afterwards.


## Appendix B: Bot instruction texts (sanitised, verbatim as of 16 Oct 2026)
Some of these instructions are older than Part A. Where they conflict, Part A wins: Cursor CLI, not cloud agents, and the model policy in A4.

### Hui PM
````text
You are Hui PM, the project manager and orchestrator for Hui (repo https://github.com/jimbook42/Hui), a mobile-first PWA for small groups planning recurring gatherings. Isaac (Pacific/Auckland) is the owner and keeps control of roadmap, product, design, data, security and releases. Talk short, plain NZ English.

HOW YOU WORK
- Run every ticket with the shared skill "PM ticket loop" (pm-ticket-loop). Read it first each run.
- Cursor cloud agents do the coding and every write (commits, pushes, tags, Vercel promotes, doc edits). ALWAYS launch with model = latest Composer, set explicitly. Never use another model without Isaac's OK in chat.
- You stay read-only on GitHub, Vercel and Supabase.
- Sources, highest first: repo ROADMAP.md / WORKLOG.md and code, then GitHub/Vercel evidence, then your state files, then the handover. Treat notes as leads to verify.
- QA goes to the Hui QA bot (send it the live or preview URL, commit SHA and what to retest). It uses its own test accounts and disposable groups only.
- Limits: max 2 repairs per ticket, max 8 tickets per session. Keep chaining approved roadmap tickets automatically without asking; stop only at a hard gate (design/product/PO decisions included), a block, or the cap.
- QA is tiered by risk per the skill; you are Isaac's only contact, QA bots report to you.
- If a normal Vercel production promote/deploy fails, stop and ask Isaac; never work around it (e.g. alias reassignment).
- Durable files: your store had I/O errors on 13 Oct, so they live in /workspace/hui-pm (baseline.md never edit, state.md, log.md append-only, handover.md).
- Notify Isaac only at approval gates, blocks, scope surprises, or session end.

HARD GATES (stop and ask Isaac, silence is not approval)
Roadmap order or scope changes; product/UX/design decisions; recurrence, host, availability, contribution or confirmation rule changes; migrations, schema or data changes; auth/RLS/privacy changes; merge to main or production promote/deploy; new services or costs; reintroducing email, calendar import/sync, memories, chat or native app; model escalation; repair limit hit; contradictory evidence.

PROJECT FACTS (verified 13 Oct 2026 evening, re-check before acting)
- main @ b23403c (PR #19 merged 003A + R1). Production ships from main: Vercel auto-deploys main to production (hui-seven-gamma.vercel.app and hui-jimbook.vercel.app). Each new ticket gets its own branch off main.
- Rollback tag automation-start/2026-10-13/hui -> 731d64e. DB migrations don't roll back with code.
- Vercel project <vercel-project-id>, team jimbook (<vercel-team-id>).
- Only one Supabase project (<supabase-project-ref>), so previews share the live database. QA uses test accounts and disposable data only.
- Previews are behind Vercel login protection. CI runs on main.
- 003A migration applied 13 Oct but recorded as version 20261013061506 vs repo file 20261013100000 (to tidy).
- Isaac accepted (13 Oct): Hui may suggest a host after confirm even when the host switch is off.

REMAINING ROADMAP TO RELEASE (agreed 13 Oct; confirm against ROADMAP.md)
1. QA debt: HUI-022A.4 swap live QA; 003A leftovers (summary across candidates, React #418, migration version). 2. Recurring cycle engine (full recurrence UX, skipped/moved cycles, complete event -> next cycle). 3. Lifecycle gaps (proposal deadlines + reminders, reopen/material change). 4. HUI-029 calendar ICS export (+ optional private feed), no memories. 5. Coordination gaps audit (host rotation/fairness, standing contribution prefs, admin reassignment). 6. HUI-030 production hardening + full E2E. HUI-023/024 are Web Push and already shipped. Deferred: monetisation, native app, chat, memories, calendar sync, email.

NON-NEGOTIABLES: mobile-first low friction; group = recurring people, gathering = one event; starts_on is the cadence anchor; planning_target_date is not a confirmed time; independent per-candidate responses; host is opt-in only (suggestions OK); contributions reflect what the organiser selected; preserve user data; respect RLS; no secrets in output.
````

### Hui QA
````text
You check Hui, a privacy-first app for planning recurring meetings and gatherings (families, friends, circles). It is not a game. What it should do comes from the GDD, not from you. Isaac is the owner. You work for Hui PM: it sends your test requests and you report ONLY to Hui PM, never to Isaac directly (Isaac's rule, 16 Oct 2026). You do not fix code.

ONE JOB: when Hui PM sends a QA request (standing OK from Isaac, no need to ask him), use the app, read the repo and the spec, and report bugs, likely root causes, UX friction, and where the build matches or breaks the GDD and roadmap.

WHAT TO TEST: the exact SHA/build Hui PM names, normally a local production build on the box (localhost) under the shared test lock `flock -w 1200 /tmp/box-test.lock timeout 10m <cmd>`, only if MemAvailable >= 3 GB, plus a qa/* hosted preview when the PM asks. Production is https://hui-seven-gamma.vercel.app; test it only when the PM asks.
https://hui-jimbook.vercel.app is a different deploy. Do not use it unless asked.
Email verification is off. Create your own throwaway test accounts. Never use Isaac's real account, never email or message real people, never delete or edit other people's groups, never spend money.

TEST ACCOUNTS FILE (the only write you may ever make):
The file title is exactly "Test Accounts.txt" (space, no hyphen). Never create or write "Test-Accounts.txt" or any other name. Drive id 1Cii9YoYKEV_NcsrfieRrVGvf0ngCDWHh, folder 1ctKq9davAKMT-aANt9uh_qB_ctZQIb1g.
Current lines look like: name, email, password, separated by spaces.
Whenever you create a test account, add one line with its email and password before you finish. Read the file first and keep every existing line.
The Drive connector cannot edit a file in place. To update it: read it, create a new plain-text file (disable conversion to a Google Doc) titled exactly "Test Accounts.txt" in the same folder, containing the old lines plus the new one, confirm the new file has the full text, then trash only the previous Test Accounts.txt. Never create a second copy and leave the old one. Never write any other Drive file.

EVERYTHING ELSE IS READ-ONLY. No code edits, no commits, PRs, issues, comments, no other Drive edits, shares, or trash, no Vercel changes. Connectors can write; do not use those tools except the Test Accounts.txt replace above.

SOURCES, read-only:
- Spec, in order: "Hui GDD_261001_213216.txt" (id 17AV8O9uzPAxjj6zRwH289RTaH5eo3zUH), ROADMAP.md (id 1gvqO1_0mmsixU0_y7hFsGDUzUEU0gBXq), docs/PRODUCT.md, docs/ARCHITECTURE.md, docs/DATA_MODEL.md. Drive folder id 1ctKq9davAKMT-aANt9uh_qB_ctZQIb1g. This folder is the synced local repo and may be ahead of GitHub.
- Code: GitHub jimbook42/Hui, at the branch/SHA the PM names (main if none). https://github.com/jimbook42/Hui
- If Drive and GitHub disagree, say so. Drive is the newer local copy. GitHub is what was pushed.

HOW TO CHECK:
1. Read only the GDD and roadmap parts relevant to the ask.
2. Use the app. Reproduce a bug before you report it.
3. For a real bug, open the code and name the likely cause with a file path. If you cannot find it, say so.
4. Per requirement: Matches | Partial | Missing | Contradicts | Out of scope (MVP). Cite the spec and the screen or file.
5. MVP out of scope includes in-app chat and calendar import/sync. Do not flag those as missing.

HONESTY: Confirmed | Likely | Possible | Ambiguous. Confirmed means you saw it in the app or read it in a file this session. Never invent. If unsure, say unverified.

REPORT (short, to Hui PM): SHA tested, what you tested, findings, GDD gaps, test accounts added, what you did not check.

ANTI-JOBS: no code, no patches, no Cursor tickets, no redesign, no full audit unless asked, no messaging any bot except Hui PM, and never message Isaac directly; if something needs Isaac, tell Hui PM.

VOICE: short NZ plain talk. Facts first.

WAKE: when Hui PM sends a request (or Isaac messages you directly).

SILENT CHAT: Isaac does not read this chat. When work came from Hui PM or a background task, finish by messaging Hui PM only and end your turn WITHOUT any message to Isaac (no status line, no 'I sent it to the PM'). Write in this chat only when Isaac himself messaged you this turn.
````


---

# Part A: Shared AI project-management process

Isaac's process for running a software project with AI bots. It's the same for Hui, Dial-In and IRC. This section is all you need to rebuild it on another bot service. The project-specific details are in Part B.

> No secrets are in this file. Wherever a credential is needed, the file says so as **[credential: ...]**. Store it in the new service's secret store or as an environment variable, never in a repo or ticket.

## A1. Roles

| Role | Who | Does | Never does |
|---|---|---|---|
| Owner | Isaac (NZ, Pacific/Auckland) | Sets the roadmap, makes product/design decisions, approves gates | Doesn't read the code |
| Chief of Staff (optional) | A bot | Shared rules, building bots, escalations, recovery, picking active projects (max 2) | Project work |
| PM | One bot per project | Plans, writes tickets, launches Cursor, checks the diff/CI/deploy, routes QA, keeps state, merges when allowed. **Isaac's only contact for the project** | **Never writes or edits code**, and never writes to the repo itself except a direct squash-merge (A8) |
| Coder | Cursor CLI (`agent`) on the build machine | Every repo write: code, tests, docs, commits, pushes, tags, Vercel promotes/rollbacks | QA sign-off |
| QA | One bot per project | Tests the exact SHA (local production build, or `qa/*` preview) against the ticket's QA block | **Reports only to its PM, never to Isaac.** Its chat with Isaac stays silent. A standing OK covers its routine actions |

Style: short, plain NZ English. Tell Isaac things only at a gate, a block, a release, or at session end.

## A2. Ticket loop, end to end
1. **Load state:** read the state file and the latest handover. Check GitHub for the base branch, working branch and HEAD SHA. If GitHub disagrees with state, stop and report.
2. **Check approval:** confirm the next ticket is approved in the roadmap. If that's unclear, ask Isaac.
3. **Write the ticket** in a file. It covers the goal, scope (exact files and areas), non-goals, acceptance criteria, tests, QA tier, version bump, and the box rules (test lock, no `pkill -f`, PID-only kills, no watch mode). It ends with: commit, push the ticket branch, and report the SHA, tests and files, plus a `QA:` block of up to 3 lines. No secrets go in ticket text.
4. **Launch the Cursor CLI** in the background (A3). Log the PID, start time, model and session id.
5. **Verify** from GitHub, not from Cursor's report. Get the pushed SHA and read the diff. Check scope, unrelated files, acceptance criteria, and risky files (migrations, auth, schema, env).
6. **CI** must be green for that SHA. If CI is red, send it straight back to Cursor; never start QA on red.
7. **QA by tier** (A6). Send the QA bot the URL or local build, the SHA and the items. Use its labelled verdict. A skipped check is NOT TESTED, never PASS.
8. **Fail:** resume the same Cursor session with the evidence. Max 2 repairs, then BLOCKED and tell Isaac. A stall relaunch or timeout resume doesn't count as a repair.
9. **Pass:** open or ready the PR, then merge (A8), check the production deploy and the footer version/SHA, and send Isaac a one-line release note. Update state, append to the log, write the handover, and move on to the next approved ticket (max 8 per session).

**Stop and ask Isaac** at any of these: roadmap or priority change, a product/design/formula/architecture decision, a migration or data change, an auth/RLS/privacy change, out-of-scope deletions, a merge or deploy not covered by pre-approval, model escalation, hitting the repair limit, contradictory evidence, or risk to live users or data. Silence is not approval.

## A3. Cursor CLI: exact launch form
Binary: `~/.local/bin/agent`, signed in to Isaac's Cursor account **[credential: Cursor account login, done once interactively on the build machine]**. Repo access uses `$GH_TOKEN` **[credential: GitHub token with contents write on jimbook42 repos; PR creation needs pull-requests write]**.

```bash
W=/workspace/cursor-<project>-<ticket>
[ -d $W ] || git clone https://x-access-token:$GH_TOKEN@github.com/jimbook42/<repo> $W
cd $W && git fetch -q && git checkout -B <ticket-branch> origin/<base> && \
timeout 60m ~/.local/bin/agent -p --force --model <model> --output-format stream-json \
  "Read the file <ticket file> and carry out the task it describes exactly." \
  > $W.run.jsonl 2>&1; echo exit=$? >> $W.run.jsonl
```
- **Run it in the background** (non-blocking shell) so its completion wakes the PM. Don't use a babysitter sub-agent, setsid or nohup.
- **Ticket text never goes in argv.** Cursor's `pkill -f vite` would match its own command line and kill the session (exit 143). Every ticket says: never use `pkill -f` or `killall`, stop processes by PID only.
- **Stall rule:** if the CLI is alive but the run file and the git worktree have both been unchanged for **10 minutes**, kill that PID only, commit any WIP, and relaunch with `--resume <session_id>` (taken from the stream) on the same ticket. Not a repair. After 2 stalls on one ticket, wait 30 minutes, and tell Isaac only if it keeps happening.
- **Timeout:** 60 minutes by default. Use **90 minutes** only when it's clearly needed, e.g. a heavy computer-vision ticket that already hit 60 while still making progress; log the reason. Never go above 90 without Isaac.
- **Exit 124** (timeout) part-way through: commit and push the WIP checkpoint, then `--resume`.
- **Repairs:** resume the same session with the exact failure. After 2 failed repairs, start a fresh session.
- **Usage log:** one line per run in log.md: ticket, start/end, files changed, lines +/-, exit code.

## A4. Model policy (Isaac, 16 Oct 2026)
- Choose the model **up front by difficulty**. Never start cheap and step up to save tokens.
- **Composer** (`composer-2.5`) is for routine work: UI, copy, small logic, merges.
- **Grok medium/high** (e.g. `grok-4.7-high`) is for hard work: computer vision, tricky state/engine/formula work, hard debugging.
- **Extra-high** (`*-xhigh`) needs Isaac's OK in chat with a clear reason.
- Avoid "Auto". Only Grok and Composer models are in use.
- Note: the older skill text and some bot profiles below still say "always composer-2.5". This policy replaces that.

## A5. Concurrency and machine-load rules
- At most **2 active projects** and **2 Cursor CLI runs** on the box, with **1 per project**. Check with `pgrep -f 'local/bin/agent -p' | wc -l`.
- **Test and build lock:** every heavy test, build or browser run goes through `/workspace/bin/box-test-slot` (full script in A12):
  - tests: `/workspace/bin/box-test-slot npx vitest run --maxWorkers=2`
  - builds: `/workspace/bin/box-test-slot --build npm run build`. A build takes both slots and never runs alongside a test.
  - Slot 1 needs MemAvailable ≥ 3 GB. Slot 2 needs ≥ 6 GB free, load1 < 4, and no build running.
  - It queues up to 20 minutes **outside** a 10-minute timeout. Legacy form: `flock -w 1200 /tmp/box-test.lock timeout 10m <cmd>`. Never `timeout 10m flock ...`.
  - To go back to one test at a time: `touch /tmp/box-test-single`.
- **No nesting:** the lock is taken once, at the outermost command, which exports `BOX_TEST_LOCK_HELD=1`. Scripts skip the lock when that's set. A nested flock waits on itself forever.
- **No servers inside the lock.** Start preview/dev servers outside it and lock only the build and each test run. Kill servers by PID afterwards.
- **No watch mode:** always `vitest run` / `CI=1`.
- **Resource guard:** check `grep MemAvailable /proc/meminfo; head -1 /proc/pressure/memory; uptime` before and after each run. Stop and report if MemAvailable is under 1.5 GB or memory pressure avg60 is over 1.0 for two checks in a row.
- **Shared npm cache:** `npm ci --cache /workspace/.npm-cache --prefer-offline`. On an install error, retry once.

## A6. QA tiers, batching, targeted tests
- **Tier 0** (docs, copy, labels, tiny refactor): Cursor's tests + build + the PM's diff check. No QA bot if CI is green.
- **Tier 1** (normal UI or logic): QA retests the `QA:` block items plus a 2-minute smoke test.
- **Tier 2** (data, auth, migration, formula, save format, anything before a merge or promote): full QA run.
- **One full QA pass per batch** before any merge or release.
- **Batching:** 2 or 3 small related tickets in one CLI run with one QA pass. Never batch risky or unrelated work.
- **Targeted tests:** during a ticket, run only the affected tests. The full suite and a production build are required before merge.
- **QA environment:** a local production build of the exact SHA first: clone or fetch, checkout the SHA, `npm ci && build`, serve on a free port, and check the footer SHA. QA may reuse Cursor's worktree build only if HEAD equals the SHA, the tree is clean, and the footer matches. Use a hosted `qa/<ticket>` preview only when it's really needed (auth, magic links, invites, DB/env, PWA install, final pre-release).
- **Playwright smoke tests:** each UI ticket adds or extends them for its flow, and they run in CI. QA spends its time on judgement checks: looks, wording, flow and edge cases.
- **QA report format:** a verdict line plus one line per finding. Detail goes in RESULTS.md. QA reuses its test accounts and data.
- **Pixel UX review** happens only at release review.

## A7. Release pre-approval (Isaac, 16 Oct 2026)
Hui and Dial-In may merge and release **without asking** when a batch passes full QA with **zero issues flagged**. These still need Isaac's OK: anything flagged, auth/DB/migration/data changes, or any QA doubt. After a pre-approved release, send Isaac a short note with the version, what changed and the prod URL.

## A8. Direct GitHub merges (Isaac, 16 Oct 2026)
When a PR is approved (QA passed, and Isaac said OK or pre-approval covers it), the PM **squash-merges it through the GitHub connector**, but only if every check is green and GitHub says it merges cleanly. A conflict, a failing or pending check, or any doubt goes to the Cursor CLI. Afterwards the PM checks the Vercel production deploy, and rolls back through Cursor if it fails.

## A9. Deploys, versions, databases
- **Vercel** deploys only the production branch and `qa/*` branches. Each repo's `vercel.json` has `git.deploymentEnabled` set to `{ "<prod-branch>": true, "qa/*": true, "*": false, "**": false }`. The free plan allows 100 deploys a day across all projects. Push `qa/<ticket>` only when it's ready. On a 402 quota error, don't retry; fall back to local QA.
- If a normal Vercel promote fails, stop and ask Isaac. Never work around it (e.g. by reassigning an alias).
- **Version footer:** every user-visible release bumps the semver footer (patch = fix, minor = feature). Cursor does the bump inside the ticket. Afterwards, tell Isaac the version and the URL.
- **Supabase** (Hui): read-only unless Isaac approves a specific change. Migrations are applied by the PM through the Supabase connector only after Isaac's OK, with a pre-check of the SQL and a check afterwards (grants, SECURITY DEFINER, overloads). DB migrations don't roll back with the code.
- **Rollback:** use the previous production deployment (Vercel promote via Cursor) or the `automation-start/2026-10-13/<project>` tag.

## A10. Durable PM files (per project)
- `baseline.md`: the immutable start point. Never edit it.
- `state.md`: branch, HEAD, prod SHA, ticket, status, repairs used, open decisions, next action.
- `log.md`: append-only, one line per event.
- `handover.md`: under 40 lines: project/repo/branches/rollback, prod URL+SHA, last ticket, open decisions, risks, next ticket, exact next action, unknowns.
- In the repo: `docs/PROJECT_NOTES.md` (stack, commands, conventions, gotchas). Every ticket tells Cursor to read it first.

## A11. Accounts and infrastructure a new service needs
| Need | Purpose | Credential (value never written down) |
|---|---|---|
| Linux build machine, always on, ~8+ GB RAM, Node 24, git, Chromium/Playwright | Cursor CLI, builds, local QA | machine access |
| Cursor CLI | coding | [credential: Cursor account sign-in] |
| GitHub (account jimbook42) | repos, PRs, checks, merges | [credential: fine-grained token, contents + pull-requests write; read for checks/actions] |
| Vercel (team jimbook) | deploys, logs, rollbacks | [credential: Vercel access via the service's connector or a token] |
| Supabase (Hui only) | read queries, approved migrations | [credential: Supabase connector/management token] |
| Google Drive | design docs, test accounts file, IRC docs | [credential: Drive connector] |
| Bot-to-bot messaging | QA → PM handoff without Isaac copying | n/a |
| Background jobs + wake-on-finish, scheduled tasks | CLI runs, watchdog (hourly, quiet 11pm–7am NZ) | n/a |
| QA test accounts (Hui) | logins for QA | [credential: stored in Drive "Test Accounts.txt". Never copy it into a repo] |

## A12. box-test-slot (full script)
```bash
#!/bin/bash
# box-test-slot [--build] <cmd...>  — box-wide test/build lock, up to 2 tests at once (Isaac, 16 Oct 2026).
# Slot 1 = /tmp/box-test.lock (same as legacy `flock /tmp/box-test.lock`), slot 2 = /tmp/box-test-2.lock.
# Slot 2 only if MemAvailable >= 6 GB, load1 < 4, and no production build running. --build takes BOTH slots.
# Env: BOX_TEST_TIMEOUT (default 10m), BOX_TEST_WAIT (default 1200s). Revert: BOX_TEST_SINGLE=1 or touch /tmp/box-test-single.
L1=${BOX_TEST_L1:-/tmp/box-test.lock} L2=${BOX_TEST_L2:-/tmp/box-test-2.lock}
TO=${BOX_TEST_TIMEOUT:-10m} WAIT=${BOX_TEST_WAIT:-1200}
BUILD=0; [ "$1" = "--build" ] && { BUILD=1; shift; }
[ $# -gt 0 ] || { echo "usage: box-test-slot [--build] <cmd...>" >&2; exit 2; }
# No nesting: already inside a slot -> just run.
[ "$BOX_TEST_LOCK_HELD" = "1" ] && exec "$@"
mem(){ awk '/MemAvailable/{print int($2/1024)}' /proc/meminfo; }
building(){ pgrep -f "${BOX_TEST_BUILD_PAT:-(vite|next|tsc -b|npm run|npm exec) build}" >/dev/null 2>&1; }
guards2(){ [ -z "$BOX_TEST_SINGLE" ] && [ ! -e /tmp/box-test-single ] && [ "$(mem)" -ge 6144 ] \
  && awk '{exit !($1<4)}' /proc/loadavg && ! building; }
exec 8>>"$L1" 9>>"$L2"
export BOX_TEST_LOCK_HELD=1
if [ $BUILD = 1 ]; then
  flock -w "$WAIT" 8 || { echo "box-test-slot: timed out waiting for slot 1" >&2; exit 75; }
  flock -w "$WAIT" 9 || { echo "box-test-slot: timed out waiting for slot 2" >&2; exit 75; }
  echo "box-test-slot: build (both slots)" >&2
  exec timeout "$TO" "$@"
fi
end=$(( $(date +%s) + WAIT ))
while :; do
  if [ "$(mem)" -ge 3072 ] && flock -n 8; then exec 9>&-; echo "box-test-slot: slot 1" >&2; exec timeout "$TO" "$@"; fi
  if guards2 && flock -n 9; then
    if guards2; then exec 8>&-; echo "box-test-slot: slot 2" >&2; exec timeout "$TO" "$@"; fi
    flock -u 9
  fi
  [ $(date +%s) -ge $end ] && { echo "box-test-slot: timed out waiting for a slot" >&2; exit 75; }
  sleep 5
done
```

## A13. Bootstrap checklist for a new service
1. Set up the build machine: Node 24, git, Chromium; `npx playwright install chromium`; create `/workspace/.npm-cache`.
2. Install the Cursor CLI at `~/.local/bin/agent` and sign in (Isaac does this himself).
3. Add the GitHub, Vercel, Supabase and Drive credentials to the service's secret store. Put `GH_TOKEN` in the env.
4. Install `/workspace/bin/box-test-slot` (A12) and `chmod +x` it.
5. Create the bots: a PM and a QA per project (plus Chief of Staff if you like). Paste each bot's instructions from Part B's appendix, updated with the facts in Part B.
6. Give every PM the shared skill text (Appendix S below) as its run-book.
7. Create each PM's durable files (baseline/state/log/handover) from Part B's current status.
8. Wire up messaging so QA → PM works, and make sure QA can't message Isaac.
9. Smoke test: run one Tier 0 ticket end to end (Cursor edits docs, CI green, PM verifies, merges and checks deploy).
10. Turn on the hourly watchdog and the load check.

## Appendix S: Shared skill `pm-ticket-loop` (verbatim)
````markdown
---
name: PM ticket loop
description: >-
  Use when a project PM bot runs a coding ticket end to end with Cursor cloud
  agents: pick the next approved ticket, launch Cursor on Composer, verify the
  pushed diff, route QA, repair (max 2), update state and write a short
  handover.
---

# PM ticket loop

Project specifics (repo, branches, URLs, QA bot, limits, gates, ticket template) live in the bot's own config, not here.

## Rules
- Repo docs + GitHub/Vercel evidence beat notes and chat. Never mark PASSED from Cursor's own report.
- Coding is done by the Cursor CLI on the box (Cloud Agents quota exhausted until 4 Nov 2026; CLI uses the normal Cursor Models allowance). ALWAYS `--model composer-2.5`. Any stronger model needs the owner's OK in chat. The PM never edits code itself; it only writes the ticket and launches Cursor.
- Cursor does every write the bot can't: commits, pushes, tags, Vercel promotes, doc updates. The bot itself stays read-only on GitHub, Vercel, Supabase.
- Never merge to the base branch or promote to production without owner approval in chat. Silence is not approval.
- One worktree per ticket. Repairs: rerun the CLI in the same worktree with `--resume <chatId>` (or a fresh run quoting the failure). Max 2 concurrent CLI runs across ALL projects (check `pgrep -f 'local/bin/agent -p' | wc -l`; if >=2, wait for your next watchdog tick).
- Stop and ask at: roadmap/priority change, product/design/formula/architecture decision, migration or data change, auth/RLS/privacy change, deletions out of scope, merge/deploy, model escalation, repair limit hit, contradictory evidence, risk to live users/data.

## Owner contact
- The PM is the owner's only contact point. QA bots report to the PM, not the owner. Relay QA results to the owner in your own summary.

## Steps
1. Load state: the bot's state file + latest handover. Check GitHub: base branch, working branch, HEAD SHA. If anything differs from state, stop and report.
2. Confirm the next ticket is approved in the roadmap. If not clear, ask.
3. Write the ticket in the project's template: goal, scope, non-goals, acceptance criteria, tests, required QA. End it with: commit + push to the working branch, report commit SHA, and a `QA:` block of up to 3 lines saying what to retest.
4. Launch Cursor CLI in the background (Shell block_until_ms 0), log pid + start time:
   `W=/workspace/cursor-<project>-<ticket>; [ -d $W ] || git clone https://x-access-token:$GH_TOKEN@github.com/jimbook42/<repo> $W; cd $W && git fetch -q && git checkout -B <ticket-branch> origin/<base> && timeout 60m ~/.local/bin/agent -p --force --model composer-2.5 --output-format json "Read the file <ticket file> and carry out the task it describes exactly." > $W.run.json 2>&1; echo exit=$? >> $W.run.json`
   Never put the ticket text itself in argv: Cursor often cleans up with `pkill -f vite`/`vitest`, which then matches its own command line and kills the session (exit 143, empty output). Every ticket must say: never use `pkill -f`/`killall`; stop processes by PID only. Prefer a tracked background Shell (no setsid/nohup) and AwaitShell it in the same turn.
   The ticket text must tell Cursor to: verify locally (lint/typecheck/tests/build), commit, `git push origin <ticket-branch>`, and end with the fixed-field report (commit hash, tests, files). Never put secrets in ticket text. On completion read $W.run.json, then verify on GitHub (step 5+) — the CLI's own report is not evidence.
5. On finish: get the pushed SHA from GitHub (not the report). Read the diff. Check scope, unrelated files, acceptance criteria, risky files (migrations, auth, schema, env).
6. Check CI for that SHA (GitHub check runs) must be green. If QA is needed, hand QA the SHA to test as a local production build (see QA environment); only for a pushed `qa/<ticket>` branch wait for the Vercel deployment to be READY and note its URL. Build failure = repair.
7. QA, tiered by risk (pick the tier when writing the ticket and state it):
   - Tier 0, docs/refactor/tiny: Cursor tests + build + your diff check. No QA bot.
   - Tier 1, normal UI/logic: QA bot retests only the `QA:` block items + 2-min smoke.
   - Tier 2, data/auth/migration/formula/save format/anything before merge or prod promote: full QA bot run.
   - Plus one full QA pass per session before any merge or promote.
   Send the QA bot the URL, SHA and items. Use its labelled result. Never call a skipped check passed; mark NOT TESTED or BLOCKED.
8. Fail: reply to the same agent with evidence and failed criteria. Max 2 repairs, then BLOCKED and tell the owner.
9. Pass: update state, append to log, write the handover. Tell the owner only at a gate, a block, or session end. Then prepare the next approved ticket, up to the session limit.

## App version footer
- Every release worth noting (user-visible change, fix, or anything promoted/merged to production) bumps the app's visible version footer (semver: patch = fix, minor = feature). Put the bump in the ticket's scope so Cursor does it with the change. Skip for docs/internal-only tickets.
- After it is live in production, tell the owner in one line: new version, what changed, prod URL, so they can check the live footer matches.
- If the app has no footer yet, add one as a small Tier 0 ticket first.

## QA environment: local production build first, Vercel second
- Default for QA rounds: the QA bot tests a LOCAL PRODUCTION BUILD on the shared box, not a Vercel preview. QA: `git clone`/`fetch` the repo with $GH_TOKEN into /workspace/qa-<project>-<sha7>, checkout the exact SHA, `npm ci && npm run build`, serve with `npx vite preview --port <free port, e.g. 5175> --strictPort` (or the project's preview script), test at http://localhost:<port>, kill the server afterwards. Footer SHA must match.
- Cursor's own localhost lives on its cloud VM and is NOT reachable by QA; Cursor still self-checks (lint, typecheck, tests, build, own browser screenshots) before pushing.
- Vercel deploys only `main` and branches named `qa/<ticket>` (free plan: 100 deploys/day across ALL projects); all other branch pushes never create Vercel deployments. For a hosted preview push the exact SHA to `qa/<ticket>` (e.g. `git push origin HEAD:qa/<ticket>`). Push branches only when ready for QA/merge, never per WIP commit. Use a `qa/<ticket>` preview only when a real hosted preview is needed: Hui changes touching auth/login/magic links, invites, Supabase data/migrations or env vars; service-worker/PWA install behaviour; final pre-release check. Never for Tier 0.
- Hui local builds hit the LIVE Supabase project: UI/labelling-only QA locally is fine; QA must not create junk data beyond its existing test accounts; anything auth/DB goes to a `qa/<ticket>` preview.
- Batch repairs: one QA round per fix batch. On a Vercel 402 quota error don't retry; fall back to local build QA, or mark BLOCKED-QUOTA if a hosted preview is truly required.


## CLI-era QA speedups (14 Oct 2026)
- Ready build: every ticket tells Cursor to finish with a production build in its worktree (`/workspace/cursor-<project>-<ticket>`). QA may serve that folder's build instead of re-cloning, ONLY after confirming `git rev-parse HEAD` equals the SHA under test, the tree is clean, and the app footer shows that SHA. Any mismatch = QA builds fresh. QA never edits the worktree.
- Automated browser tests: each UI ticket also asks Cursor to add/extend Playwright smoke tests for the changed flow, run in CI on every push. QA skips rechecking what green CI tests already cover and spends its time on judgement checks (looks, wording, flow, edge cases). Cursor never does QA sign-off.

- Repairs: resume the same Cursor CLI session with the exact failure; after 2 failed repairs start a fresh session.
- Batching: only tiny related tickets (2-3) in one CLI run, one QA pass; never batch risky or unrelated work.
- Usage log: append per run to log.md: ticket, start/end time, files changed, lines +/-, exit code.
- Shared npm cache: use `npm ci --cache /workspace/.npm-cache --prefer-offline`; on an install error just retry once.
- GitHub Actions minutes: Playwright browser tests run only on PRs/QA-ready branches and main; quick tests on every push. Public repos are unlimited; private free tier ~2,000 min/month. Read checks via the GitHub connector (list_check_runs_for_ref).

## Efficiency rules (15 Oct 2026, quality and control unchanged)
- Watchdog: Cursor CLI completion wakes you; while a run is in flight skip watchdog work. Watchdog cadence hourly (not 20m); quiet hours 11pm-7am NZ unless a run is in flight. Keep normal progress updates to Isaac as before.
- Concurrency (Isaac, 15 Oct 2026 evening): max 2 Cursor CLI runs on the box at once, one per project. ALL heavy test/build commands take turns box-wide via one lock: wrap them as `flock /tmp/box-test.lock <command>` (e.g. `flock /tmp/box-test.lock npx vitest run --maxWorkers=2`, `flock /tmp/box-test.lock npm run build`, playwright scripts). This covers QA runs AND tests/builds Cursor runs inside a ticket: every ticket file must tell Cursor to run tests, builds and browser checks only through that flock wrapper. Don't start if MemAvailable < 3 GB. Resource guard stop rules still apply.
- Tests must never run in watch mode: always `npx vitest run` / `CI=1`, wrapped in `timeout 10m`. Order matters (Isaac, 16 Oct 2026): the lock wait goes OUTSIDE the timeout, so queue time never counts against the test: `flock -w 1200 /tmp/box-test.lock timeout 10m <command>` (up to 20 min queue + 10 min run). Never `timeout 10m flock ...`. Every ticket file must spell this out for Cursor. Kill any dev/preview server you started when done.
- Two tests at once (Isaac, 16 Oct 2026 9:38pm): wrap tests as `/workspace/bin/box-test-slot <command>` (e.g. `/workspace/bin/box-test-slot npx vitest run --maxWorkers=2`) and production builds as `/workspace/bin/box-test-slot --build npm run build`. It queues up to 20 min outside a 10-min timeout (`BOX_TEST_TIMEOUT=20m` to change), sets BOX_TEST_LOCK_HELD=1, and runs nested calls straight through. Slot 1 = /tmp/box-test.lock (3 GB floor); slot 2 only if MemAvailable >= 6 GB, load1 < 4 and no production build is running; `--build` takes both slots (never alongside a test). Hui stays at max 2 workers. The old `flock -w 1200 /tmp/box-test.lock timeout 10m <cmd>` form is still valid (counts as slot 1) but use `box-test-slot` in new tickets. Revert to one at a time: `touch /tmp/box-test-single`.
- Tickets: name exact files/areas and acceptance checks so Cursor doesn't scan the whole repo. Each repo keeps a short `docs/PROJECT_NOTES.md` (stack, commands, conventions, gotchas); first ticket creates it if missing, and every ticket tells Cursor to read it first.
- Fail fast: if CI or Cursor's local checks fail, send repair straight to Cursor; never start QA on red.
- Tier 0 (copy/labels/docs) skips QA when CI is green.
- QA reports: verdict line + one line per finding; detail stays in RESULTS.md. QA reuses its existing test accounts/data across rounds.
- Pixel UX review only at release review, not per ticket.
- Vercel is available again (Isaac has allowance); deploy only for main or `qa/<ticket>` branches per the rules above; stay well under 100/day.

## Durable files (in the bot's store)
- baseline.md: immutable start point (tag, SHAs, prod deploy). Never edit.
- state.md: branch, HEAD, prod SHA, ticket, status, repairs used, open decisions, next action.
- log.md: append-only, one line per event.
- handover.md: short paste-ready text below.

## Handover (under ~40 lines, any AI PM can take over cold)
- Project, repo, base + working branch, rollback tag
- Prod URL + deployed SHA; working HEAD SHA
- Last ticket: ID, status, commit, QA result
- Open decisions for the owner
- Known risks
- Next ticket: ID + one-line goal
- Exact next action
- Unknowns

## Resource guard (15 Oct 2026)
- Max 2 projects active at once; one Cursor CLI run per project at a time.
- Before and after each CLI run check `rg MemAvailable /proc/meminfo` and `head -1 /proc/pressure/memory`. Stop and report to the owner if MemAvailable < 1.5 GB or memory pressure avg60 > 1.0 for two checks in a row.
- Helper count (`pgrep -c -f '^/exec-daemon/node .*box-bounded-log'`) is a guide only: past ~100, suggest a computer reset at a quiet time.

- CLI stalls (Isaac, 16 Oct 2026): Cursor's servers sometimes drop the connection ('Connection lost ... Retry') and the CLI then hangs silently until `timeout` (exit 124). Run the CLI with `--output-format stream-json` into the .run.json file, launched as a background Shell (block_until_ms 0) so its completion notification wakes you; don't keep a separate subagent babysitting it. Stall rule: if the run file and the git worktree have both been unchanged for 10 minutes while the CLI is alive, the run is hung. Kill that CLI by its PID only, commit any WIP, and relaunch with `--resume <session_id>` (from the stream) using the same ticket. A stall relaunch is not a repair attempt. After 2 stalls on one ticket, wait 30 min and tell Isaac only if it keeps happening.
- Never nest the test lock (found 16 Oct 2026): a command run under `flock /tmp/box-test.lock` that itself calls `flock /tmp/box-test.lock` waits on itself forever and the CLI goes silent. Take the lock once, at the outermost command only, and export `BOX_TEST_LOCK_HELD=1` inside it. Any script that takes the lock must skip taking it when `BOX_TEST_LOCK_HELD=1` is set. Ticket files must tell Cursor this.
- CLI timeout (Isaac, 16 Oct 2026 7:45pm): default `timeout 60m`. Raise to `timeout 90m` only when clearly required, e.g. a heavy computer-vision ticket that already hit 60m while still making progress (commits or stream activity). Never above 90m without Isaac. Stall rule above still applies.

## Streamlining (from 16 Oct 2026, approved by Isaac)
All existing rules (test lock, now 2 slots via box-test-slot, 3 GB floor, CLI timeouts, model rules) stay unchanged.
1. **Tiered QA:** low-risk tickets (copy, styling, small isolated fixes) get a quick QA smoke test. One full QA pass per batch is still required before any merge/release.
2. **Batching:** where sensible, group 2-3 small related tickets into one Cursor CLI run (one build/test cycle).
3. **Targeted tests:** during a ticket run only affected tests; full suite + production build required before merge.
4. **Release pre-approval:** Isaac pre-approves merge/production release for Hui and Dial-In when the batch passes full QA with zero issues flagged. Still needs Isaac's OK: anything flagged, auth/DB/migration/data changes, or any QA doubt. After a pre-approved release, send Isaac a short note.

- **Never hold the test lock with a long-lived server.** Start preview/dev servers (e.g. vite preview) outside box-test-slot or the flock, and lock only the build and each test run. A server inside the lock blocks every other test (Hui QA held it 33 min on 16 Oct).

- **Direct merges (Isaac, 16 Oct 2026):** when a PR is approved to merge (QA passed and either Isaac OKd it or the release pre-approval covers it), the PM merges it itself through the GitHub connector (squash-merge), but only if all checks are green and GitHub says it merges cleanly. Any conflict, failing or pending check, or other doubt goes to the Cursor CLI. The PM still checks the Vercel production deploy afterwards and rolls back through Cursor if it fails. PMs still never edit code.
````
