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
- **Notifications** — reminders and activity (no chat).
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

Supabase Auth (email/password) for sign-up, verification, sign-in, and sign-out. Public routes include `/sign-in` and `/sign-up`. `/dashboard`, `/profile`, and `/groups` require a session: middleware refreshes cookies and redirects unauthenticated visitors to sign-in; protected layouts also call `auth.getUser()` on the server.

Group administration uses the HUI-005 schema and RLS. Creation and self-leave call `create_group` and `leave_group` RPCs so ownership and membership stay consistent without widening update policies. Admins add existing accounts by user ID (shown on the profile page); email invitations are not implemented yet.

Events use the same HUI-005 `events` and `recurrence_series` tables. Server Actions in `src/app/events/actions.ts` enforce group settings (who may propose, one-off vs recurring) before insert; RLS remains authoritative. New gatherings start in `proposing` status. Candidate times and private availability responses use `event_candidates` and `event_responses` via `src/app/events/scheduling-actions.ts` (no consensus or finalisation yet). Routes: `/groups/[groupId]/events`, `/groups/[groupId]/events/new`, `/events/[eventId]`.

Server Components and Server Actions use the server Supabase client with cookie-backed sessions; RLS enforces row access. The database assumes `auth.uid()` and does not implement a second login system. A trigger inserts `profiles` when `auth.users` gains a row; the app may call `ensureUserProfile` idempotently after sign-in when needed.

## Tenancy and RLS

Migrations in `supabase/migrations` are the schema source of truth. Every public table has row level security enabled and forced. Policies apply to `authenticated`. `anon` has no policies and no table grants. The service role is for server maintenance and bypasses RLS; application code must not send that key to the browser.

Access is membership, not a client check:

- A person can read and update their own profile, and can read display names of people with whom they share an active membership.
- Active members can read that group's gatherings, settings, and group-visible responses. Non-members cannot.
- Owner and admins manage settings, households, categories, and membership. Ordinary members cannot. The owner calls `transfer_group_ownership` to hand the group on.
- Dietary rows are private until the owner shares them with a group. A share stops applying once either person is no longer active there.
- Private availability responses are not readable by other members. A later consensus calculation that needs those answers has to be a trusted server path, not a wider `select` policy.
- Membership removal flips `group_memberships.status` to `removed`. It does not cascade into events, responses, hosts, contributions, or memories.

Policies must not query `group_memberships` under its own RLS. `is_active_member`, `is_group_admin`, and `is_group_owner` are `SECURITY DEFINER`, `STABLE`, and pinned to `search_path = public`. They return a boolean for `auth.uid()` only. The same pattern is used for dietary visibility, so those policies do not recurse through each other. `transfer_group_ownership` and the profile, settings, audit, and memory-snapshot triggers are definer functions for the same reason: the caller cannot be given a general write on those rows.

The database enforces tenancy, proposer rights (`who_may_propose`), one-off versus recurring flags, and the maybe-response switch. It stores event status, veto flags, deadlines, and consensus settings, and leaves those transitions to the domain layer.

Group rules are columns on `group_settings`, not a JSON document. The MVP set is known and should stay constrained. Recurrence rows store a week/month interval only; occurrence generation is later application code.

## Storage

Supabase Storage for user-generated media (e.g. memories) with bucket policies aligned to group membership.

## Testing

- **Vitest** — domain and application logic. `src/db/rls-foundation.test.ts` applies `supabase/migrations` on in-process Postgres and checks tenancy. `supabase start` needs Docker, which is optional for that test.
- **Playwright** — critical user journeys once flows exist.

## PWA and offline behaviour

Hui uses `@serwist/turbopack` for a minimal service worker: build-time precaching of static shell assets only, with **network-only** runtime caching (including Supabase and `/api`).

> Hui may be installable and provide limited static/offline behaviour, but private user/group/event data must not be treated as safely cacheable offline data by default.

When offline, navigations show `/offline`; the app does not sync data or pretend to be fully offline-capable. Web Push and notifications are out of scope for the PWA foundation.

## Deployment

Build a standard Next.js output; deploy to Vercel or another Node/static host. Environment variables point at the Supabase project; no host-specific database.
