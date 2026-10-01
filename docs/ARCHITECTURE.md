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

Supabase Auth for sign-in/session (later tickets). Server Components and route handlers use the server client with the user session; RLS enforces row access.

## Storage

Supabase Storage for user-generated media (e.g. memories) with bucket policies aligned to group membership.

## Testing

- **Vitest** — domain and application logic.
- **Playwright** — critical user journeys once flows exist.

## Deployment

Build a standard Next.js output; deploy to Vercel or another Node/static host. Environment variables point at the Supabase project; no host-specific database.
