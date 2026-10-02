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
