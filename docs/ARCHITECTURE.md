# Architecture (lightweight)

Hui is a privacy-first PWA backed by Supabase. This document describes intended boundaries, not a full implementation map.

## Stack

| Layer | Choice |
| --- | --- |
| Frontend | Next.js (App Router), TypeScript, Tailwind CSS |
| UI components | shadcn/ui when UI work needs shared primitives |
| Backend | Supabase (Postgres, Auth, RLS, Storage, Edge Functions as needed) |
| Unit/domain tests | Vitest |
| E2E tests | Playwright |
| Source control | Git |
| Initial hosting | Vercel (optional); database stays on Supabase |

## Layering

```text
UI (React components, pages)
↓
application / use-case orchestration
↓
domain rules (pure logic, testable)
↓
persistence & integrations (Supabase client, storage, export)
```

- UI should not embed authoritative business rules.
- Application layer coordinates transactions and calls domain + persistence.
- Domain layer holds consensus, eligibility, and rotation rules (Vitest targets here).
- Persistence uses Supabase with RLS as the authority for who can read/write what.

## Major domain boundaries (planned)

- **Identity** — accounts, profiles, sessions (Supabase Auth).
- **Groups** — membership, roles, group settings.
- **Events** — proposals, candidates, responses, consensus, hosting (recurring and one-off).
- **Contributions & dietary** — fairness and preferences tied to events/members.
- **Notifications** — in-app activity (`member_notifications`) is the record. HUI-023 adds opt-in Web Push for those rows. No chat, email, or SMS.
- **Export** — calendar export for confirmed events.
- **Memories** — post-event history attached to events/groups.

Realtime subscriptions only where they clearly improve UX; not by default.

## Supabase clients

Supabase is Hui’s persistent backend and source of truth (Postgres, Auth, RLS, Storage).

- **Browser** (`src/lib/supabase/client.ts`) — `createBrowserClient` with `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` only.
- **Server** (`src/lib/supabase/server.ts`) — `createServerClient` with the same public credentials and cookie handlers for sessions.
- **Middleware** (`src/lib/supabase/middleware.ts`) — refreshes auth cookies on navigation so server routes can read the session later.

The publishable (anon) key is safe for its intended public client use but is **not** authorisation: every table must use **RLS** before production data access.

`SUPABASE_SECRET_KEY` (service role) must stay server-only, never in `NEXT_PUBLIC_*` variables, and never shipped to the browser.

## Authentication

Supabase Auth is the sole login system. **Canonical Hui identity** is `auth.users.id` (the session user’s uuid). `profiles.id`, `group_memberships.user_id`, event ownership, and RLS all key off that id — not email. Email/password, **Google OAuth**, **Microsoft OAuth** (Supabase provider `azure`), and **Facebook OAuth** (Supabase provider `facebook`, when enabled in `src/lib/auth/providers.ts`) are available sign-in methods.

Public routes include `/sign-in` and `/sign-up`. `/dashboard`, `/profile`, `/groups`, and `/events` require a session: middleware refreshes cookies and redirects unauthenticated visitors to sign-in; protected layouts also call `auth.getUser()` on the server. OAuth completes at `/auth/callback`, which exchanges the Supabase authorization code for a session cookie and runs `ensureUserProfile` before redirecting to the requested in-app path.

**Social authentication.** Provider enablement lives in `src/lib/auth/providers.ts`. **Google**, **Microsoft (Azure)**, and **Facebook** use the same Hui flow: Supabase `signInWithOAuth` → provider consent → `/auth/callback` session exchange → `ensureUserProfile`. Azure requests the `email` scope (`oauthScopes` on the Azure provider); Google and Facebook rely on Supabase’s default OAuth scopes (Facebook Login should include `public_profile` and `email` in the Meta app so Supabase receives an email — without email, Auth rejects the callback). Each enabled provider must also be turned on in the Supabase Auth dashboard; client secrets stay in Supabase, never in the repository. **Apple** remains **disabled** until a separate integration ticket. `AuthOAuthSection` on sign-in/sign-up renders third-party controls only for enabled providers. Do not merge Hui accounts by matching email alone; future work should use Supabase identity linking where supported so one Hui user keeps one auth identity.

Group administration uses the HUI-005 schema and RLS. Creation and self-leave call `create_group` and `leave_group` RPCs so ownership and membership stay consistent without widening update policies. Admins add existing accounts by user ID (shown on the profile page); email invitations are not implemented yet.

Events use the same HUI-005 `events` and `recurrence_series` tables. Server Actions in `src/app/events/actions.ts` enforce group settings (who may propose, one-off vs recurring) before insert; RLS remains authoritative. New gatherings start in `proposing` status. Candidate times and private availability responses use `event_candidates` and `event_responses` via `src/app/events/scheduling-actions.ts`. Consensus is a pure function in `src/domain/scheduling/consensus.ts`. Active members read aggregate counts from `event_consensus_summary` (no response identities). `finalise_event` re-reads those rows under a row lock and is the only path from `proposing` to `confirmed`. Event detail UI (`EventScheduling`, HUI-017) renders those server summaries and the viewer’s own responses only; presentation helpers in `src/domain/scheduling/consensus-display.ts` format labels and empty states but do not evaluate rules. Group members on the event page reuse the household grouping view for roster context; consensus remains per-member. Routes: `/groups/[groupId]/events`, `/groups/[groupId]/events/new`, `/events/[eventId]`.

**Event flow architecture (planned workstream HUI-026A–E).** The domain remains shared, but primary user tasks should be separated from summary and management surfaces: `/events/[eventId]` is concise summary plus next action; `/events/[eventId]/respond` is the participant response flow; `/events/[eventId]/manage` is proposer/admin management; and `/groups/[groupId]/events/new` becomes a staged proposal flow. The dashboard is intended to surface proposed, decision-ready, and upcoming confirmed events that need attention. This is an interaction architecture workstream, not a replacement for the existing HUI-025–030 GDD capability tickets.

Primary interactions should follow a deterministic lifecycle—acknowledgement, pending, success/error, and reconciled UI—with idempotency and server/RLS authority preserved. Performance investigation includes action latency, refreshes, query volume, re-renders, stale server props, form state transitions, duplicate submissions, and N+1 queries. **HUI-026P.2** adds dev-only interaction marks in the browser (`?hui_perf=1` or `localStorage hui_perf=1`; see `docs/performance/HUI-026P.2-audit.md`) and server spans via `HUI_DEV_PERF=1`. Participant attendance on `/events/[eventId]/respond` advances the visible step immediately on tap and reconciles persistence in the background.

Server Components and Server Actions use the server Supabase client with cookie-backed sessions; RLS enforces row access. The database assumes `auth.uid()` and does not implement a second login system. A trigger inserts `profiles` when `auth.users` gains a row, using provider `full_name`, then `name`, then app `display_name` metadata, then the email local-part; the app may call `ensureUserProfile` idempotently after sign-in when the row is missing. Provider name metadata may be used only when creating an initial profile. Existing user-selected display names are authoritative and must not be overwritten by subsequent authentication.

**Account deletion (HUI-012B).** Profile settings expose a two-step “Delete my account” flow with typed `DELETE` confirmation. `deleteAccountAction` first removes the Supabase Auth user with `createSecretSupabaseClient()` (`SUPABASE_SECRET_KEY`, server-only) and verifies the identity is gone, then calls `delete_my_account_data()` via the session client (JWT `auth.uid()` still valid in that request). Success UI (`/sign-in?deleted=1`) runs only when both steps succeed. If Auth deletion fails, Hui data is unchanged and the user can retry. If Auth succeeds but the RPC fails, the user sees a failure message (sign-in already removed). Postgres and Auth are not one transaction. See `docs/DATA_MODEL.md`.

## Tenancy and RLS

Migrations in `supabase/migrations` are the schema source of truth. Every public table has row level security enabled and forced. Policies apply to `authenticated`. `anon` has no policies and no table grants. The service role is for server maintenance and bypasses RLS; application code must not send that key to the browser.

Access is membership, not a client check:

- A person can read and update their own profile, and can read display names of people with whom they share an active membership.
- Active members can read that group's gatherings, settings, and group-visible responses. Non-members cannot.
- Owner and admins manage settings, categories, and group membership. Ordinary members cannot change those. The owner calls `transfer_group_ownership` to hand the group on.
- Households belong to one group. Active members can read household names and membership for grouping in that group. Mutations run through `create_household`, `update_household_name`, `add_household_member`, and `remove_household_member` (`SECURITY DEFINER`, `auth.uid()` checks, `search_path = public`). Direct inserts/updates/deletes on `households` and `household_members` are not granted to `authenticated`.
- Contribution categories are group-scoped rows on `contribution_categories`. Owner and admins create, rename, and archive (`archived_at`) categories through table RLS. Event claims use `event_contributions` with member ownership (`user_id`, not households). Claiming, updating a label, and releasing a current claim run through `claim_event_contribution`, `update_my_event_contribution`, and `release_event_contribution` so release is possible despite the contribution snapshot trigger locking assignees on update. Fairness in HUI-018 is transparent counts from stored accepted contributions on confirmed/completed events only — no scores or auto-assignment.
- Host assignments use `host_assignments` with member-level `user_id` in the app flow (household hosts remain a schema capability only). Proposers and group admins assign or change hosts on confirmed events through `assign_event_host`; when `host_veto_enabled` is on, the row stays `proposed` until the member calls `respond_to_host_assignment`. Rotation suggestions in HUI-020 count accepted member hosts on confirmed/completed events only (cancelled events excluded) — no scores, ranks, or silent auto-hosting.
- Dietary rows live on `dietary_entries` (owned by `profiles.id`, not households). They are private until the owner inserts a row in `dietary_entry_shares` for a group they belong to. `can_read_dietary_entry` and `can_read_dietary_share` are `SECURITY DEFINER` helpers; select policies use them so members never read unshared entries and removed members lose current access even if a share row remains. Owners manage entries and shares from `/profile` (Server Actions in `src/app/dietary/actions.ts`); group and event pages list only shared entries via `listGroupSharedDietary`. Event contribution UI may show an aggregate count of shared requirements — not individual private labels through contribution queries.
- Private availability responses are not readable by other members. Consensus counts for those answers come from `event_consensus_summary` and `finalise_event`, which do not return individual responses. Do not widen the `event_responses` select policy so the client can compute consensus.
- Membership removal flips `group_memberships.status` to `removed`. It does not cascade into events, responses, hosts, contributions, or memories.

Policies must not query `group_memberships` under its own RLS. `is_active_member`, `is_group_admin`, and `is_group_owner` are `SECURITY DEFINER`, `STABLE`, and pinned to `search_path = public`. They return a boolean for `auth.uid()` only. The same pattern is used for dietary visibility, so those policies do not recurse through each other. `transfer_group_ownership` and the profile, settings, audit, and memory-snapshot triggers are definer functions for the same reason: the caller cannot be given a general write on those rows.

The database enforces tenancy, proposer rights (`who_may_propose`), one-off versus recurring flags, and the maybe-response switch. It stores event status, veto flags, deadlines, and consensus settings. Consensus maths stay in the domain layer. `finalise_event` is the trusted write that applies them: it locks the event, counts private responses without returning them, and confirms one candidate. Ordinary updates cannot set `confirmed` or mark a candidate `selected`. `proposal_deadline_hours` is stored and is not applied to an event clock yet.

Group rules are columns on `group_settings`, not a JSON document. The MVP set is known and should stay constrained. Recurrence rows store a week/month interval only; occurrence generation is later application code.

## Storage

Supabase Storage for user-generated media (e.g. memories) with bucket policies aligned to group membership.

## Testing

- **Vitest** — domain and application logic. `src/db/rls-foundation.test.ts` applies `supabase/migrations` on in-process Postgres and checks tenancy. `supabase start` needs Docker, which is optional for that test.
- **Playwright** — critical user journeys once flows exist.

## PWA and offline behaviour

Hui uses `@serwist/turbopack` for a minimal service worker: build-time precaching of static shell assets only, with **network-only** runtime caching (including Supabase and `/api`).

> Hui may be installable and provide limited static/offline behaviour, but private user/group/event data must not be treated as safely cacheable offline data by default.

When offline, navigations show `/offline`; the app does not sync data or pretend to be fully offline-capable. Web Push and external notification providers are out of scope for the PWA foundation.

**In-app notifications (HUI-021).** `member_notifications` stores short, privacy-safe messages for the authenticated member. Rows are created by database triggers on meaningful event/host/contribution changes and by `sync_reconnect_reminders_for_member()` when a group with reconnect settings has been inactive (last non-cancelled event activity, or group creation if none). Members manage read state via `mark_notification_read` / `mark_all_notifications_read`. `/notifications` lists items; profile settings include `member_reconnect_reminders_enabled` to opt out of reconnect reminders only. No browser permission prompts.

**Web Push preferences (HUI-024).** The five default-on `profiles.push_*_enabled` settings group the existing eligible kinds into event proposals, decision-ready, confirmation, host assignment, and contribution changes. `queue_member_notification` always creates the canonical in-app row, then checks the recipient's matching setting before creating a new Web Push outbox row. Changing a preference does not alter historical notifications or existing outbox rows.

## Deployment

Build a standard Next.js output; deploy to Vercel or another Node/static host. Environment variables point at the Supabase project; no host-specific database.
