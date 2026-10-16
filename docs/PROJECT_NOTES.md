# Project notes (agent scratch)

- **Stack:** Next.js App Router, Supabase (RLS + RPCs), Vitest + PGlite for SQL tests, Playwright E2E against live Supabase when `E2E_TEST_*` env is set.
- **Commands:** `npm run validate` (lint, typecheck, test, build); E2E `npm run test:e2e`; locked runs use `flock -w 1200 /tmp/box-test.lock timeout 10m …` with `BOX_TEST_LOCK_HELD=1` inside.
- **Gotchas:** Live prod may lag repo migrations (e.g. `my_home_location`); `fetchMyHomeLocation` falls back to profile columns only when the RPC is missing. Host “At my home” must sync hidden form fields before submit. Do not apply migrations to live Supabase from agent work.
