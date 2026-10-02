# Worklog

Lightweight record of completed tickets. One entry per ticket.

## 2026-10-01 — HUI-001

- Changed: Initial Next.js/TypeScript/Tailwind PWA-ready scaffold; Vitest and Playwright wiring; project workflow and architecture docs; Cursor rule.
- Checked: `npm run build`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run test:e2e`.
- Commit: 78d97fe

## 2026-10-01 — HUI-002

- Changed: Supabase env (`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`), browser/server/middleware clients, config validation and smoke tests; architecture doc update.
- Checked: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `npm run test:e2e`.
- Commit: b10571d

## 2026-10-01 — HUI-003

- Changed: `@serwist/turbopack` service worker (network-only), App Router manifest, PNG icons, `/offline`, `SerwistProvider`; PWA caching note in architecture.
- Checked: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `npm run test:e2e`.
- Commit: a2a6a7e

## 2026-10-01 — HUI-005

- Changed: Supabase migrations for groups, membership, one event model, responses, hosts, contributions, dietary shares, and memories; RLS tenancy policies; security tests that apply those migrations.
- Checked: `npm run validate`, `npm run test:e2e`. RLS: member read, non-member and anon denial, private-row updates, removal keeping history, owner/admin restrictions.
- Commit: feat: establish Hui database foundation

## 2026-10-01 — HUI-004

- Changed: GitHub Actions CI workflow, `npm run validate`, README CI section; `.vercel` in `.gitignore`.
- Checked: `npm run validate`, `npm run test:e2e` (local); workflow YAML reviewed (CI not executed locally).
- Commit: f73da9e

## 2026-10-02 — HUI-006

- Changed: Email/password sign-up, sign-in, and sign-out; middleware and layout guards for `/dashboard` and `/profile`; profile ensure/update helpers; PGlite profile RLS tests; Playwright auth smoke tests.
- Checked: `npm run validate`, `npm run test:e2e`.
- Commit: feat: add Hui authentication and profiles

## 2026-10-02 — HUI-007

- Changed: Protected `/groups`, `/groups/new`, `/groups/[groupId]`; group server actions; `create_group` and `leave_group` migration; member ID on profile; PGlite membership tests.
- Checked: `npm run validate`, `npm run test:e2e`.
- Commit: feat: add Hui groups and membership management

## 2026-10-02 — HUI-008

- Changed: Event domain (validation, permissions, lifecycle); event queries and server actions; group event list/create and event detail UI; PGlite event management tests; `/events` auth guard.
- Checked: `npm run validate`, `npm run test:e2e`. No new migration (HUI-005 schema sufficient).
- Commit: feat: add Hui event and proposal foundation

## 2026-10-02 — HUI-009

- Changed: Scheduling domain and server actions on existing `event_candidates` / `event_responses`; event detail candidate UI with private availability responses; PGlite privacy and maybe-disabled tests.
- Checked: `npm run validate`. No new migration (HUI-005 schema and RLS sufficient).
- Commit: d136391

## 2026-10-02 — HUI-010

- Changed: Pure consensus evaluator for the three existing rules; `event_consensus_summary` and `finalise_event` so private responses stay hidden and confirmation is atomic; event page shows aggregate results and lets the proposer or an admin confirm one passing time.
- Rules: `yes` accepts; `maybe` accepts only when maybe responses are enabled; minimum attendees always applies; `required_participants` uses `consensus_required`; several passing times are an explicit choice, ordered by start then id for display.
- Not in this ticket: `proposal_deadline_hours` is still only a group setting. No event deadline is stored, so it is not enforced.
- Checked: `npm run validate`, `npm run test:e2e`. Migration `20261002140000_event_consensus_finalisation.sql`.
- Commit: 5438c6d

## 2026-10-02 — HUI-011

- Changed: Auth provider registry (`providers.ts`) with Google, Apple, Facebook, and Azure disabled by default; `AuthOAuthSection` on sign-in/sign-up (renders nothing until a provider is enabled); OAuth validation stub and canonical identity notes; architecture, decisions, and roadmap backlog for future social login.
- Checked: `npm run validate`.
- Commit: 1ab529e

## 2026-10-02 — HUI-012

- Changed: Google OAuth via Supabase `signInWithOAuth`, `/auth/callback` session exchange, `ensureUserProfile` on first OAuth login; Google enabled in provider registry (Apple/Facebook/Microsoft remain disabled); auth UI “Continue with Google”; tests and architecture doc update. Google client credentials stay in Supabase dashboard only. Follow-up: `redirect()` is outside the OAuth action catch so Next.js can send the browser to Google, and provider `access_denied` is cancellation rather than a generic failure.
- Checked: `npm run validate`, `npm run test:e2e`.
- Commit: 360a207; redirect fix 6008e72; redirect fix 6008e72

## 2026-10-02 — HUI-012A

- Changed: `initial_profile_display_name` SQL helper and updated `handle_new_user` trigger (`full_name` → `name` → `display_name` → email local-part); shared `initialDisplayNameFromAuthMetadata` for OAuth callback, sign-in, and protected layout; tests and architecture note that existing display names are never overwritten on re-auth.
- Checked: `npm run validate`, `npm run test:e2e`.
- Commit: d310d80

## 2026-10-02 — HUI-012B

- Changed: `delete_my_account_data` migration (personal data purge, sole-member group delete, profile tombstone), profile “Delete my account” UI, server `deleteAccountAction` + `SUPABASE_SECRET_KEY` Auth admin delete, PGlite deletion/re-registration tests, docs.
- Checked: `npm run validate`, `npm run test:e2e`.
- Commit: ecf0f92

## 2026-10-02 — HUI-012B (follow-up)

- Changed: two-step account deletion UX (irreversible warning → typed `DELETE` confirmation); `ROADMAP.md` status reflects preview env gap and pending manual validation.
- Preview config: `vercel env ls` shows `SUPABASE_SECRET_KEY` absent from Preview/Production/Development on `jimbook/hui` (only `NEXT_PUBLIC_SUPABASE_*` set).
- Checked: `npm run validate`, `npm run test:e2e`.
- Pending: add `SUPABASE_SECRET_KEY` to Vercel Preview, redeploy, full destructive preview test before merge (PR #9).
- Commit: 153d431

## 2026-10-02 — HUI-012B (preview deletion bug)

- Root cause: (1) RPC ran before Auth delete, so a failed Auth step left a tombstoned profile while `auth.users` still existed and blocked retry; (2) `profiles` RLS hid the user’s own tombstone row, so protected layout never signed them out; (3) middleware redirected signed-in users away from `/sign-in?deleted=1` back to the app, so the success banner appeared while the session still looked active; (4) `deleteUser` success was not verified with a follow-up admin lookup.
- Fixed: Auth delete + verification first, then RPC; idempotent RPC; RLS allows reading own profile for guards; middleware allows `deleted=1` sign-in; sign-in page clears stale session on success; tombstone-only layout redirect uses `deletion_incomplete=1` not success copy; integration/unit tests for Auth deletion helper.
- Pending: push migration to hosted Supabase, redeploy preview, manual destructive retest.
- Commit: 37d6d9d

## 2026-10-02 — HUI-012B (complete)

- Status: complete. Manual preview validation passed. No deletion or session bug remains.
- Manual preview: account deletion succeeds; the Auth user is deleted; old credentials fail; the same email registers again as a fresh account. Supabase email confirmation stayed disabled for the current testing configuration (out of scope; unchanged).
- Policy: typed `DELETE` confirmation; Auth delete and verification first, then `delete_my_account_data`; shared history kept on an anonymised profile; re-registration is a new auth id with no email re-link.
- Checked: `npm run validate`, `npm run test:e2e`.
- Commit: a0ab037

## 2026-10-02 — HUI-013

- Changed: Enabled Microsoft OAuth in `providers.ts` (`azure` Supabase provider) alongside Google; reuses existing `oauthSignInAction`, `signInWithOAuthProvider`, and `/auth/callback` flow with HUI-012A display-name precedence (`full_name` → `name` → `display_name`). Updated provider/unit/e2e tests and architecture doc. No callback or identity-merging changes.
- Architecture: Microsoft → Supabase Auth (`signInWithOAuth` provider `azure`) → Hui `/auth/callback` → session + `ensureUserProfile` (existing names preserved).
- Manual: In Supabase Dashboard → Authentication → Providers → Azure, enable the provider and set Azure AD application (client) ID and secret; ensure redirect URLs include the Supabase callback URL and production site URL is in Supabase redirect allow list. Live Microsoft sign-in not verified in this session (requires dashboard enable + Microsoft account).
- Checked: `npm run validate`, `npm run test:e2e` (7 passed, 1 live-auth skipped).
- Commit: a479946

## 2026-10-02 — HUI-013A

- Root cause: Azure `signInWithOAuth` did not request `scopes: "email"`. Supabase Auth only asks Azure for `openid` unless the client sends extra scopes, then rejects the provider callback when no email is returned (`error=server_error`, `error_description=Error getting user email from external provider`). Hui’s `/auth/callback` maps any non-`access_denied` `error` to `oauth=failed` and drops `error_description`, which is the generic “Social sign-in could not be completed” notice. Microsoft consent itself succeeded; failure is Supabase’s callback, before `exchangeCodeForSession`.
- Changed: `oauthScopes: "email"` on the Azure provider definition; `signInWithOAuthProvider` passes it only when set. Google options unchanged. Callback and display-name logic unchanged.
- Checked: `npm run validate` (120 tests), `npm run test:e2e` (7 passed, 1 live-auth skipped).
- Pending: production Microsoft sign-in retest after deploy. If Azure still omits email, add the Graph `email` delegated permission and the `email` optional claim on the Entra app (documented by Supabase; not a Hui code change).
- Commit: 62e95ca

## 2026-10-02 — HUI-014

- Changed: Enabled Facebook OAuth in `providers.ts` (`facebook` Supabase provider) alongside Google and Microsoft; reordered provider registry to Google → Microsoft → Facebook in UI. Reuses `oauthSignInAction`, `signInWithOAuthProvider`, `/auth/callback`, and HUI-012A display-name precedence. Added provider brand icons on OAuth buttons (`auth-oauth-provider-icon.tsx`). Updated unit/e2e tests and architecture doc.
- Architecture: Facebook → Supabase Auth (`signInWithOAuth` provider `facebook`) → Hui `/auth/callback` → session + `ensureUserProfile` (existing names preserved; no email-based merging).
- Meta/Supabase: Production OAuth start verified (Continue with Facebook → Facebook login with `redirect_uri` `https://xmvzzypefpiethefrfka.supabase.co/auth/v1/callback` and Hui `redirect_to` `/auth/callback`). Meta app appears configured with Supabase. End-to-end sign-in through Facebook credentials not run in this session (use Meta test user or app role in Development mode).
- Checked: `npm run validate` (127 tests), `npm run test:e2e` (7 passed, 1 live-auth skipped); PR CI and main CI passed.
- PR: https://github.com/jimbook42/Hui/pull/12 — merge `249da30` on `main`; production https://hui-seven-gamma.vercel.app/sign-in shows Google, Microsoft, Facebook.
- Pending: Manual retest completing Facebook login → dashboard and repeat sign-in (display name preserved).

## 2026-10-02 — HUI-015

- Changed: Reworked `/profile` into an account settings surface (Profile + Account sections) with card layout aligned to auth screens; display name save with `refreshOnSuccess` so the field reflects persisted data; read-only account email; sign-in method labels from Supabase `user.identities` (no linking/merging); Member ID for group admins; dedicated Sign out in Account alongside existing HUI-012B deletion flow. Added `auth-methods` and `update-display-name` unit tests; expanded profile e2e coverage (unauthenticated redirect, email display, reload persistence).
- Decisions: Email remains non-editable in UI; OAuth tokens/provider secrets not shown; auth methods are informational only; header nav Sign out retained plus Account section control.
- Checked: `npm run validate` (138 tests), `npm run test:e2e` (8 passed, 1 live-auth skipped); PR CI and main CI passed.
- PR: https://github.com/jimbook42/Hui/pull/13 — feature commit `2b3210a`, merge `7dce96c` on `main`; production https://hui-seven-gamma.vercel.app/profile (unauthenticated redirect verified).
- Manual: display name edit/reload, sign-out/in, delete-account entry point — for account holder on production.

## 2026-10-02 — HUI-016

- Changed: Per-group household management via migration `20261002180000_household_member_management.sql` (`create_household`, `update_household_name`, `add_household_member`, `remove_household_member`; admin-only direct writes removed). Profile **Household** section (one card per active group); group detail shows members grouped by household. Server actions, queries, domain validation/display helpers; PGlite household tests; live-auth Playwright household journey (skipped without E2E credentials). Updated `ARCHITECTURE.md` and `DATA_MODEL.md`.
- Checked: `npm run validate` (149 unit tests), `npm run test:e2e` (8 passed, 2 live-auth skipped); PR #14 and main CI passed.
- Commit: `62ef343` — PR: https://github.com/jimbook42/Hui/pull/14 — merge `9da6081` on `main`; production https://hui-seven-gamma.vercel.app (deployment `dpl_9iNYLvdkVTTJ5gNdoGe92eLTfHaK`, READY).
- Manual: Run `supabase db push` (or apply the new migration) on the linked Supabase project before household RPCs work in production. Optional: run live household E2E with `E2E_TEST_EMAIL` / `E2E_TEST_PASSWORD`.

## 2026-10-02 — HUI-017

- Changed: Event detail scheduling UX (`EventScheduling`): per-candidate aggregate **Attendance** blocks from `event_consensus_summary`, rule/requirement copy, status badges, finalisation locking message, withdrawn-candidate list, confirmed/cancelled banners; household-grouped **Group members** roster (`EventParticipantsSummary`). Presentation helpers in `consensus-display.ts` (Vitest). No schema or consensus rule changes; `finalise_event` unchanged.
- Checked: `npm run validate` (159 tests), `npm run test:e2e` (8 passed, 3 live-auth skipped); PR #15 CI and Vercel preview passed.
- Commit: `6ce0338` — PR: https://github.com/jimbook42/Hui/pull/15 — merge `3655b90` on `main`.
- Manual: Optional live event E2E with `E2E_TEST_EMAIL` / `E2E_TEST_PASSWORD`; multi-user consensus/finalisation smoke on preview/production.

## 2026-10-02 — HUI-018

- Changed: Contribution coordination on existing `contribution_categories` / `event_contributions` — migration `20261002200000_contribution_coordination.sql` (`claim_event_contribution`, `update_my_event_contribution`, `release_event_contribution`). Group admins manage categories on the group page; event **Contributions** section (still needed / claimed / yours); transparent history counts on group and per-viewer hint on events. Domain validation/display, server actions, PGlite contribution tests, live-auth Playwright journey (skipped without E2E credentials). `ARCHITECTURE.md` updated.
- Checked: `npm run validate` (171 tests), `npm run test:e2e` (8 passed, 4 live-auth skipped); PR #16 CI and Vercel preview passed.
- Commit: `b4b0fb7` — PR: https://github.com/jimbook42/Hui/pull/16 — merge `041bc97` on `main`.
- Manual: Apply migration `20261002200000_contribution_coordination.sql` on linked Supabase (`supabase db push`) before claim/release RPCs work in production. Optional: live contribution E2E with `E2E_TEST_EMAIL` / `E2E_TEST_PASSWORD`.
- Follow-ups: Dietary coordination (Phase 6); optional category ordering; multi-user E2E for cross-member edit denial.
