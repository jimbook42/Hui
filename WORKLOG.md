# Worklog

## 2026-10-16 — v0.18.13 docs (ROADMAP + HANDOVER)

- `ROADMAP.md`: release path v0.18.13 → full prod QA → beta; post-beta deferred list.
- `docs/HANDOVER.md`: repo copy with Part B refreshed (prod v0.18.12 @ a31f6e4, `qa/v0.18.13-feedback`, migration pending approval).

## 2026-10-16 — v0.18.12 fix1 former member roster + upcoming host cleanup

- Migration `20261016210000_hui_former_member_roster.sql`: roster + display counts for deleted-account responders; `delete_my_account_data()` drops upcoming `host_assignments` and clears `creator_initial_host_user_id` after UX6 place strip.
- Event creator join fallback: `Former member` when profile is hidden (`queries.ts`).
- PGlite + roster Vitest coverage.

## 2026-10-16 — HUI-UX6 v0.18.12 delete host place + privacy statement

- Migration `20261016190000_hui_ux6_delete_host_place.sql`: `delete_my_account_data()` nulls `events.location` / lat / lng for every hui the leaver hosted (via `host_assignments`).
- `/privacy` matches approved `hui-privacy-final.md` (Last updated 16 October 2026); PGlite + component tests.
- **Part C:** `/sign-in/email` shows `Email or password is incorrect.` on failed sign-in; clears on field edit/resubmit.

## 2026-10-16 — v0.18.11 welcome tagline + stepper scroll-to-top

- Landing tagline: “Regular catch-ups, without the group chat chaos.”
- `useScrollTopOnStepChange` on proposal, respond, and personal setup; Vitest + Playwright propose Continue scroll smoke.
- **fix1:** delete-account uses `useFocusOnStepChange` (focus only, no window scroll).

## 2026-10-16 — v0.18.10 fix2 (bring Add something, non-member load, 404)

- **Add something:** Organisers with no group bring categories need the contributions disclosure **open by default** (`contributionsDisclosureDefaultOpen`); link stays inside `EventContributionsSection` but was hidden in a collapsed `<details>`. Integration test covers `DisclosureCard` + section path.
- **Non-member slow load:** Removed parent `events/loading.tsx` and `events/[eventId]/respond/loading.tsx` so a `notFound()` on event routes is not preceded by a streamed AppShell 200 shell (RSC retry loop / 30s timeouts).

## 2026-10-16 — v0.18.10 fix1 (profile/home #418, bring, hui 404)

- **/profile/home #418:** `LocationPicker` deferred geolocation detection until after mount so SSR and hydration both omit “Use my location” on first paint.
- **Bring regression:** Invalid `<h2>` inside `<summary>` broke disclosure content; disclosure titles use `role="heading"` `aria-level={2}` instead. Component test for empty-category organiser **Add something**.
- **Hui 404 status:** Removed `events/[eventId]/loading.tsx` (streamed 200 before `notFound()`); `requireEventDetail` + `isEventId` guard malformed ids before data fetch.

## 2026-10-16 — v0.18.10 profile home save + hydration + bring heading

- **Profile home save:** PostgREST `UPDATE` default return tried to read revoked `home_location_*` columns after migration `20261016103000`; profile actions now `.select("id")` only (same pattern as display name). PGlite test for label-only home update + `my_home_location()` readback.
- **Profile #418:** `AppShell` awaited unread count once and removed Suspense fallbacks that rendered `0` unread then swapped to the real badge count on hydration.
- **Event bring heading:** Disclosure title `Who's bringing what` with semantic `h2`; `#contributions` anchor on the disclosure (inner duplicate `h2` stays hidden via `.hui-embedded`).

## 2026-10-16 — HUI-UX5 fix4 host place + bring empty + load (v0.18.9)

- **#1 Host “At my home”:** Default venue mode was `home` while React state for `location`/`coordinates` stayed empty, so `updateEventAction` called `update_event_place` with null location (HTTP 200, no visible place). Sync home fields when home mode is active; reject host-only saves without a confirmable place; `fetchMyHomeLocation` profile fallback only when `my_home_location` RPC is missing (not on permission errors). Tests: `host-venue.test.ts`, `home-location-query.test.ts`, `host-place.test.ts`; PGlite privacy migration path unchanged in `profile-home-privacy.test.ts`. E2E step in `e2e/hosts.spec.ts` (live auth).
- **#2 First-load (low-risk):** Dashboard greeting loads profile + `loadHomeData` in parallel; group page runs invite-link RPC + `resolveAuthRedirectOrigin` inside the existing `Promise.all`. Event page already parallelises `loadEventPage`; layout `getServerAuthUser` is request-cached.

| Page | Before (typical bottleneck) | After this change | Still dominates |
| --- | --- | --- | --- |
| Dashboard | Serial profile then home list (~2 Supabase round-trips in Greeting) | One parallel batch for greeting data | `DashboardEvents` + `NoGroupsStartGate` separate suspenses; middleware JWT |
| Group | 6-way parallel block then serial invite + origin | 8-way parallel including invite + origin | `getGroupDetail` + `loadGroupPlanningContext` serial upfront |
| Event | `getEventDetail` then `loadEventPage` (wide parallel inside) | unchanged structure | Detail fetch before page bundle; scheduling roster fan-out on busy hui |

QA-reported 4.5–6.8s local / 10–16s preview remains mostly Supabase latency, cold start, and sign-in — not addressed here (no caching/region changes).

- **#3 Bring:** Show “What to bring” whenever food coordination applies, even with zero categories (organiser empty state was already in `EventContributionsSection` but the disclosure was hidden).

## 2026-10-16 — HUI-UX5 fix3 past answers on deletion (v0.18.9)

- **fix3:** Same migration `20261016103000_hui_ux5_privacy_home_and_deletion.sql` — `delete_my_account_data()` deletes `event_responses` only on **upcoming** hui (not `completed`/`cancelled`, and not `confirmed` with `starts_at` already passed); **past** rows stay for yes/no counts with `note` cleared via `hui.account_deletion` bypass on `responses_before_write`. PGlite test in `account-deletion.test.ts`.

## 2026-10-16 — HUI-UX5 fix2 Sydney + privacy (v0.18.9)

- **Part A (d924b02):** `vercel.json` `regions: ["syd1"]`; availability save + middleware use `auth.getClaims()` (JWT verify) instead of session cookie user; vitest rejects forged/missing JWT on save.
- **Part B (37fd5bb):** Migration `supabase/migrations/20261016103000_hui_ux5_privacy_home_and_deletion.sql` — G1 revoke co-member `profiles` home column SELECT (grant safe columns + `my_home_location` / `co_member_host_home_location` RPCs); G2 null home on delete; G3 delete standing availability + upcoming `event_responses`, anonymise denormalised `display_name` copies; app uses `fetchMyHomeLocation` with RPC-first + profile fallback for live DB without migration.
- **PM save timing (post fix2a, prod build :3130):** tap→saved ms `[1474,940,982,1799,1262,918]`; POST ms `[1414,942,920,877]`.

## 2026-10-16 — HUI-UX5 fix1 save latency (v0.18.9)

- **Profile:** multi-time respond `aria-busy` tracks the server-action POST only (no `router.refresh` on that path). Slowness was server work per save, not client re-render after the action.
- **Server:** lightweight `loadAvailabilitySaveContext` (replaces `getEventDetail`), session-cookie auth (`getServerAuthUserFromSession`), return right after upsert (confirm snapshot moved to `fetchConfirmAfterAvailabilitySaveAction` for single-time flow), defer `/events/[id]` revalidate via `after()`, stop revalidating `/respond` on each tap.
- **Home surfaces:** debounced `revalidateHomeGatheringSurfacesAction(groupId)` restores `/groups/:id/events` refresh dropped in cc12e2c.
- **PM timing** (`next build` + `next start` :3130, proxy :3000, `zz-pm-save-timing.spec.ts`): tap→saved ms before fix1 ~[2676,2215,1907,3538,2441,2561] (cc12e2c ~4.0s mean per ticket); after fix1 ~[1075,1363,2792,1591,1661,1281] (~1.6s mean, several saves ~1.0–1.4s). Target &lt;1s not met on every tap; remaining cost is mostly Supabase round-trips on the save action.

## 2026-10-16 — HUI-UX5 pre-beta (v0.18.9)

- **Dashboard attention:** `homeViewerResponseCandidateIds` loads the **selected** time for confirmed hui even when other proposed candidates remain, so answered confirmed gatherings leave Needs attention.
- **Save latency:** availability save no longer revalidates `/dashboard`, `/events`, or group event lists on every tap; replaces post-save `getEventDetail` with a status-only read; debounced `revalidateHomeGatheringSurfacesAction` refreshes home lists after saves (respond flow + attendance live).
- **Perf note (local `next build` + `next start`, dev-timing spans):** prod ~2.3s/save was dominated by full-path revalidation and a second event detail fetch; after change, server action work is upsert + two path revalidates + one lightweight status query (target well under 1s on warm instances).
- **Alerts:** `displayNotificationTitle` maps legacy **Event confirmed** / **New event proposal** (and similar) to **Hui …: &lt;title&gt;** using quoted titles from notification bodies; push + in-app list pass body through.
- **Bring section:** clearer empty state on event **Who's bringing what** with organiser **Add something** link to the group page.

## 2026-10-16 — HUI-UX4 fix4 recurring default (PR #50)

- New hui defaults to **Recurring** (weekly cadence on first hui when unset); **Just this once** stays explicit. Established groups keep prefilled planning date + submit path. Delete-group warning copy updated.

## 2026-10-16 — HUI-UX4 fix3 copy (PR #50)

- Invite fallback sheet: join-the-group wording; manage-hui entry and remaining UI **contributions** → **what to bring**.

## 2026-10-16 — HUI-UX4 fix2 lint (PR #50)

- React Compiler: derive `establishedCadence` without `useMemo` in propose flow.
- ESLint: drop unused import in `participant-flow.ts`, unused `user` in lifecycle poll action, loop index in `install-visits.test.ts`.

## 2026-10-16 — HUI-UX4 fix1 global copy (v0.18.8)

- Dashboard greeting **Hi** (not Kia ora); no-groups copy uses **family**; remaining user-facing **Contribution(s)** strings aligned with **What to bring** / **Who's bringing what**; legacy notification title mapping for DB **Contribution updated**.
- Tests: `dashboardGreetingHeading`, `displayNotificationTitle`.

## 2026-10-16 — HUI-UX4 blind test 4 friction (v0.18.8)

- **Invite:** Single group-page invite card (Share invite / Copy link / Reset link with confirm); sheet safe-area above tab bar; join-the-group copy.
- **Propose:** Later huis default to “Just this once”; established groups choose one-off vs recurring explicitly.
- **Respond / home:** Neutral unselected Yes/Maybe/No; multi-time answers drive Your hui list status; availability save revalidates `/events` and `/dashboard`.
- **Copy:** Plain-language confirm rules and “Who’s bringing what” headings.

## 2026-10-16 — HUI-UX3-fix12 second propose + settings hash (PR #49)

- **Second propose:** `groupHasEstablishedRecurrence` treats prior huis (`isFirstGroupEvent: false` + recurring enabled) as established when group cadence columns are still empty; restore path merges cadence draft; candidate merge backfills `planningTargetDate`. E2E: first then second recurring propose.
- **Settings redirect:** `HashDisclosureOpener` on group page + retry; `DisclosureCard` omits controlled `open` when closed so hash deep links can open `<details>`; legacy settings redirect e2e.
- **Respond e2e:** dashboard wait after sign-in; settings helper waits for hash-open.

## 2026-10-16 — HUI-UX3-fix11 review gaps (PR #49)

- Respond: reserve check-icon width on attendance choices; Playwright `boundingBox()` row stability across Saving/Saved.
- Organiser confirm: assert `confirmation_method = organiser` in PGlite; `finaliseEventAction` unit test; host-Yes banner copy gated on roster.

## 2026-10-16 — HUI-UX3-fix10 QA (v0.18.7)

- Second propose: hide first-hui cadence picker on established groups; planning-date field + `fillRecurringPlanningDates`; submit test.
- Organiser confirm: no “Re-asking” after organiser confirmation; host-ready gate for organiser-picks banner.
- Respond: reserved “Your answer” row height + bottom safe-area padding; cancelled group cards show candidate dates.
- Local prod build stamp: `git rev-parse --short HEAD` via `next.config.ts`.

## 2026-10-16 — HUI-UX3-fix9 respond crash (production)

- **Root cause:** fix6 `EventLifecycleLiveRefresh` calls browser `createClient()` on respond/event pages. `getPublicSupabaseConfig()` read `process.env` via dynamic `env[key]`, so Next did not inline `NEXT_PUBLIC_*` into client chunks; production `next start` then threw “Missing Supabase configuration” on hydration (error boundary “This page couldn’t load”). fix8’s sibling-stream theory was a red herring.
- **Fix:** Literal `process.env.NEXT_PUBLIC_*` on the default path in `env.ts`; skip Realtime subscribe when public config is absent (polling-only); `env.client-bundle.test.ts` + lifecycle test guard.

## 2026-10-16 — HUI-UX3-fix8 respond page crash

- **Root cause:** fix6 added `EventLifecycleLiveRefresh` as a second client sibling on `/events/[id]/respond` while the page streams `loadRespondSecondary()` into `EventParticipantRespondFlow`; Next aborted the RSC payload (500 “This page couldn’t load”, server log `The destination stream closed early`).
- **Fix:** Mount lifecycle refresh inside `EventParticipantRespondFlow` so only one client boundary receives the promise; move `beforeunload` hook with the other effects; `respond-page-streaming-boundary.test.ts` guards the page layout.

## 2026-10-16 — HUI-UX3-fix7 lint

- `EventLifecycleLiveRefresh`: drop ref sync during render; poll callback reads `status` from deps (fixes `react-hooks/refs` CI error).

## 2026-10-16 — HUI-UX3-fix6 gaps (fix5 review)

- Event/respond pages: poll `fetchEventLifecycleStatusAction` every 10s and on focus/visibility when hui is still open; refresh on confirm (realtime kept).
- Install card: count one browser session per visit so sign-up → onboarding → dashboard does not show the card on first dashboard load.
- Attendance rows: layout test that sibling rows do not shift when one row saves.

## 2026-10-16 — HUI-UX3-fix5 QA (v0.18.7)

- Respond: fixed-height answer rows, per-candidate parallel saves, persisted-only progress count, `beforeunload` while saving; Supabase realtime refresh on confirm for event/respond pages.
- Confirmed hero copy from per-hui `confirm_rule`; organiser-picks confirm CTA on event hero when host has said Yes.
- Propose restore keeps established group cadence; review step bottom safe-area padding for bottom nav.

## 2026-10-15 — HUI-UX3 confirm rules (v0.18.7)

- Per-hui `confirm_rule` on propose + manage; host must say Yes before auto/manual confirm; migration `20261015200000_hui_ux3_confirm_rules.sql` (not applied in prod).
- PM: confirm whether `p_force` may ever bypass accepted-host Yes (implemented: **no**).
- **fix2-ci (91faeb7):** PGlite CI — `DROP` 14-arg `propose_group_event` before 15-arg + default `p_confirm_rule`; restore `when_most_can_come` → group `consensus_rule` mapping; `assign_event_host` inserts `proposed` again; prod-shaped RPC tests in `hui-ux3-confirm-rules.test.ts`.
- **fix3:** `pick_host_candidate` restored from prod (avoid-consecutive `always` ordering + `prefer_not` fallback); `proposed_host_remains_eligible` stays SECURITY INVOKER; PGlite host-pick tests.
- **fix4-grants:** migration `20261015210000_hui_ux3_helper_grants.sql` — revoke direct EXECUTE on UX3 helpers from `public`/`anon`; drop `authenticated` on `host_yes_required_for_candidate` + `event_accepted_host_user_id`; re-grant `authenticated` on `member_has_yes_for_hosting` after `PUBLIC` revoke (INVOKER `proposed_host_remains_eligible`); PGlite `hui-ux3-helper-grants.test.ts`.

## 2026-10-15 — HUI-UX3 blind fixes (v0.18.7)

- Blind-3 QA: invite/sign-up CTA order, hui-scoped invite sheet copy, propose add-time feedback, respond progress/saved/continue copy, vocabulary (group/hui), explicit hui type on propose, editable reply-by on review, dashboard onboarding order, install card after second visit, change-response gating, email field sizing.
- Tests: join CTA, invite copy, dashboard greeting, proposal defaults, response-deadline preview, install visit gate, restore-flow label updates.
- UX3 sync2 addendum: in-place Saving on attendance buttons (stable Yes count), no Retry on confirm-race lock, client transition to confirmed view from `confirmedCandidate` action payload.

## 2026-10-15 — HUI-0186 answer reliability (v0.18.6)

- **Root cause (fix1):** `event-participant-respond-flow.tsx` wrapped every `setAvailabilityResponseAction` call in a single shared `useTransition` (`startSaveAttendance`, ~line 436). Rapid Yes taps on different proposed times started overlapping transitions; React kept only the latest transition callback, so the middle candidate’s in-flight save never ran.
- **Root cause (fix1 QA fail, 53850ff):** After removing the shared transition, three overlapping `setAvailabilityResponseAction` calls still ran in parallel. The first completion’s `revalidatePath` in `scheduling-actions.ts` (~391–392) aborted the other in-flight Next server-action streams (`The destination stream closed early` in `/tmp/s0186.log`); the client treated an empty/aborted action result as success (`event-participant-respond-flow.tsx` ~450–474, no explicit success check), so the middle candidate never reached `event_responses` (PM read-only: rows for 4 Nov + 11 Nov, none for 6 Nov). Offline Retry showed raw `Failed to fetch` (~491–493).
- **Fix:** Serialize attendance saves on the client (`serialize-attendance-saves.ts` + `event-participant-respond-flow.tsx` ~439); require explicit `{ message | notice }` success (`availability-action-outcome.ts`); friendly connection copy + Retry re-send; skip `router.refresh` on multi-time saves (~455, ~488). PGlite proves concurrent DB upserts all persist (`concurrent-member-availability-save.test.ts`).
- **Tests:** serialized multi-time saves, aborted/empty action + `Failed to fetch` + Retry, PGlite concurrent upserts, serializer unit test.

## 2026-10-15 — HUI-0186-fix4 offline Retry survives reconnect (v0.18.6)

- **Root cause (PM review 89836d0):** `SerwistProvider` in `serwist-provider.tsx` (~line 11) set `reloadOnOnline={true}`; `@serwist/turbopack` registers `window.addEventListener("online", () => location.reload())`, so Playwright `setOffline(false)` / real `online` wiped React state (`errorsByCandidate` in `event-participant-respond-flow.tsx` ~188) before the user could tap Retry.
- **Fix:** `reloadOnOnline={false}` (navigation caching already off); E2E requires Retry visible ~3s after reconnect then explicit Retry click; component test covers rerender + `online` event without clearing error.

## 2026-10-15 — HUI-0186-fix3 respond E2E + save revalidate (v0.18.6)

- **E2E:** Parse group id from `/welcome` URLs; open group settings via `/settings` + Advanced; match Yes buttons by accessible name (`/^Yes/`); wait per-save; offline Retry after reconnect (fix4 tightens assertion).
- **App:** Drop `revalidatePath` on successful `setAvailabilityResponseAction` so serialized multi-time saves are not aborted by RSC refresh (extends fix1).

## 2026-10-15 — HUI-0186-fix2 respond UI stability (v0.18.6)

- **Root cause A (PM repro, b1820be):** After the first Yes, majority auto-confirm revalidated the respond RSC payload; `respondAttendanceCandidates` (`participant-flow.ts` ~47–57) collapsed to the selected time and `multipleTimeOptions` flipped false (`event-participant-respond-flow.tsx` ~158–159), remounting the single-time UI so global `nth()` Yes taps hit shifted rows (3→2→1 buttons).
- **Root cause B:** Confirm-race recovery returned `notice` without `message` for non-selected times (`confirm-during-save.ts` ~60–65); `isAttendanceActionSuccess` treated `notice` alone as success (`availability-action-outcome.ts` ~13) and the multi-time `result.notice` branch cleared pending without reverting (`event-participant-respond-flow.tsx` ~459–466).
- **Fix:** Pin multi-time rows for the visit (`pinnedMultiTimeSession`); keep Yes pressed while saving; `notice`-only confirm race → inline error + un-press; wrong-candidate confirm race returns `error`; stop `revalidatePath` on `/respond` for availability saves; Playwright `e2e/respond-multi-time.spec.ts` (fails on b1820be layout shift / false success).

## 2026-10-15 — HUI-0185 polish (v0.18.5)

- Manage Time disclosure uses `formatEventTimeDisclosureSummary` (Re-asking when `consensusCurrentlyPasses` is false).
- Recent cancelled hui (30d cap) on home, group list, and events surfaces; `cancelled` home bucket, no attention.
- Dietary group share with zero entries via `dietary_empty_group_shares` migration (not applied in prod).
- HUI-0185-fix1: migration timestamp `20261015150000`; empty-share listing/RLS require sharer active membership; PGlite test for departed member.
- HUI-0185-fix2: privacy-first — new entries no longer auto-share from `dietary_empty_group_shares`; dietary page hints; explicit share clears empty-share row; PGlite test.
- HUI-0185-fix3: `/groups` cards show up to two recent cancelled hui per group (30d) alongside the next upcoming hui via one batched `events` query; request budget 6→7 (<15).

## 2026-10-15 — HUI-0184 follow-ups (v0.18.4)

- Re-asking status pill on event hero, manage, and home/group cards (`consensusCurrentlyPasses` / `anyCandidatePasses`, same gate as hero line).
- Home `canConfirmTime` uses batched `candidate_attendance_rosters` instead of self-only `event_responses` RLS.

## 2026-10-15 — HUI-0183 friction tier 1 (v0.18.3)

- In-app browser OAuth banner on `/`, sign-in, sign-up; reschedule re-asking hero; cancelled hero/copy; privacy sign-in list; host self-notify migration (not applied).

## 2026-10-15 — HUI-0183 batched roster RPC (v0.18.3)

- `candidate_attendance_rosters(uuid[])` security-definer batch wrapper; home dashboard uses one RPC instead of `event_responses` (RLS self-only).
- Vitest: roster under mocked RLS + request-budget mock counts batched RPC.

## 2026-10-15 — HUI-LOGS-N+1 list surface query batching (v0.18.3)

- Batch dashboard recurring planning (settings, events, recurrence prefs/skips) and build home attendance rosters without per-candidate RPC fan-out.
- `/groups` loads invite links lazily on Invite click; request-budget vitest asserts <15 Supabase calls for 40-group fixtures.

## 2026-10-15 — HUI-0182 Facebook login feature flag (v0.18.2)

- Gate Facebook OAuth UI and server start on `NEXT_PUBLIC_ENABLE_FACEBOOK_LOGIN === "true"` via `getEnabledOAuthProviderIds`; Google/Microsoft unchanged.
- Document env in `.env.example` and architecture; e2e expects two OAuth buttons when flag unset.

## 2026-10-15 — HUI-0181 invite sign-up next preservation (v0.18.1)

- Carry safe `next` through sign-in/sign-up cross-links, email auth, OAuth on sign-up, and join invite CTAs; hardened `sanitizeNextPath` (decode, backslash, scheme rejection).
- OAuth callback preserves `next` on provider errors; tests for sanitizer, auth links, and Playwright invite flow.

## 2026-10-15 — HUI-030-fix6 propose draft restore + frequency sync (v0.18.0)

- Restore propose step-1 draft from sessionStorage after client mount (SSR-safe); gate persistence until restore completes.
- Sync `meetFrequency` into `eventKind`/recurrence on pick and on restore; dedupe past-date warning copy.

## 2026-10-15 — HUI-030-fix5 propose draft + past-date warnings (v0.18.0)

- Past-date banner on propose time + review; stale auto-cancel copy omits past calendar dates.
- Proposal session draft persists meet frequency; cleared on successful submit.
- Dietary group share: confirmed scope model (all entries) — no behaviour change.

## 2026-10-15 — HUI-030-fix4 auth E2E strict labels + main merge (v0.18.0)

- Merged `origin/main` (`vercel.json` git.deploymentEnabled).
- Auth E2E: exact `getByLabel` for Email/Password on sign-up render test (avoid Confirm field collision).

## 2026-10-15 — HUI-030-fix3 privacy contact + coord-audit merge (v0.18.0)

- Privacy enquiries email `tulllabs@outlook.com` via `privacy-contact.ts` (shown on `/privacy`).
- Merged `origin/cursor/hui-coord-audit-b1cd`; `RELEASING.md` current `0.18.0`, previous `0.17.0`.

## 2026-10-15 — HUI-030-fix2 privacy page + auth E2E (v0.18.0)

- Public `/privacy` policy (NZ Privacy Act, delete-your-data section); linked from sign-in footer and profile.
- Auth E2E aligned with OAuth-first sign-in and `/sign-in/email`; group smoke helper + specs retained.

## 2026-10-14 — HUI-COORD lifecycle audit (v0.17.0)

- Documented transitions, notifications, and cron in `docs/lifecycle.md`.
- Migration `20261014210000_hui_coord_lifecycle_audit.sql`: clear deadline on confirm/cancel stale path; planning-only deadline reminders; block answers on non-proposed candidates; stale auto-cancel relies on cancel trigger (no duplicate enqueue).
- PGlite audit tests in `hui-coord-lifecycle-audit.test.ts`.

Lightweight record of completed tickets. One entry per ticket.

## 2026-10-14 — HUI-FIX1 dietary privacy + in-app install (0.16.2)

- `listUserDietaryEntries` filters by `user_id`; update/delete/share-all scope to owner; in-app browser install banner on Profile > Install.

## 2026-10-14 — First-timer UX, part C (0.16.1, HUI-UX3)

- Two-step group invite (intro sheet → Get link → share/copy); plain propose frequency step; respond Saved toasts, multi-time summaries, skip empty place step; invite lists all proposed times; auto-join to respond; dashboard Your hui for invitees; labels/tallies/jargon polish.

## 2026-10-14 — First-timer UX, part B (0.16.0, HUI-UX2)

- Fortnightly cadence preset; plainer propose/setup copy; food on time step (skippable); group settings Advanced collapse; post-create `/groups/:id/welcome` with Invite friends (share + copy fallback); YOUR ANSWER private No note across multi-time proposing.

## 2026-10-14 — PR #37 QA fixes (0.15.0)

- Confirmed hero: rule-based line (e.g. “Confirmed by majority”) plus live coming/pending tallies; no count snapshot.
- Majority rule: minimum two yes votes (`20261014140003`); majority counts yes-only per candidate (`20261014140004`).
- Member invite link RPC for all active members (`20261014140005`); hero Invite uses share/copy.
- Group page: tappable member roster sheet.
- Event QA: confirmed-candidate answer, per-time tallies, No note persist + respond UX; hide relative hero chip on confirmed (hydration).

## 2026-10-14 — First-timer UX, part A (0.15.0, HUI-UX1)

- **Defaults:** New groups default `consensus_rule` to `majority_active_members` (migrations `20261014140000` enum, `20261014140001` functions, `20261014140002` column default after release; existing groups unchanged).
- **Respond / invites:** Save toasts, optimistic answers, Maybe labelling, invite preview uses proposed candidate time, join → answer flow, deferred host prompt on hui page, confirmed “X of Y said yes”.

## 2026-10-14 — Calendar export UX polish (0.14.1, HUI-029b)

- **UI:** Icon “Add to calendar” on home/group hui tiles (confirmed + `starts_at`); secondary button with icon on event hero beside date/time; fetch download + brief auto-dismiss feedback (toast on tiles, inline on event page).
- **No migration**; reuses `GET /api/events/[eventId]/calendar.ics`.

## 2026-10-13 — ICS calendar export (0.14.0, HUI-029 partial)

- **ICS:** `GET /api/events/[eventId]/calendar.ics` for active members (RLS via `getEventDetail`); confirmed hui with start time only.
- **UI:** “Add to calendar” on confirmed event hero; UID stable per event; SEQUENCE from `new_time` reschedule audit count; no migration.

## 2026-10-13 — Auto-confirm when consensus met (0.13.0)

- **DB:** `apply_event_confirmation`, `try_auto_confirm_event`, `pick_auto_confirm_candidate` (tie-break: earliest `starts_at`, then `id`); response trigger; `finalise_event` delegates to shared path; migration `20261014113000` (not applied on linked Supabase by agent).
- **Policy:** Skips when `admin_veto_enabled`; uses existing `candidate_consensus` rules.
- **Tests:** `auto-confirm.test.ts` (domain + DB).

## 2026-10-13 — Proposal response deadlines (0.12.0)

- **DB:** `events.response_deadline_at`, `event_responses.submitted_late`, `update_event_response_deadline`, `event_proposal_reply_stats`, `enqueue_proposal_deadline_reminders`; migration `20261013220254` (applied linked Supabase).
- **App:** Reply-by on event + respond; manage deadline editor; organiser banner after deadline; daily cron field `proposalDeadlineRemindersQueued`; reopen notification names hui + group.
- **Tests:** `proposal-response-deadlines.test.ts`, reopen copy in `reschedule-confirmed.test.ts`.

## 2026-10-13 — Cancel and reopen notifications (0.11.0)

- **Kind:** `event_cancelled`; trigger on manual cancel; stale auto-cancel via `process_stale_proposals` + trigger (idempotent `event_cancelled:{event_id}`).
- **Reopen:** `notify_event_recipients_except` attendees-only before clearing responses; migration `20261014003000`.
- **Push:** `event_cancelled` / `event_rescheduled` respect `push_event_confirmed_enabled`.

## 2026-10-13 — Reschedule confirmed hui (0.10.0)

- **RPC:** `reschedule_confirmed_event_to_time`, `reopen_confirmed_event_for_proposing`; `event_reschedule_audit`; notification kind `event_rescheduled`.
- **Migrations:** `20261013194706`, `20261013220000` (GUC-only trigger tighten + force RLS on audit); applied linked Supabase 2026-10-13.
- **App:** manage-page reschedule (new time / reopen proposing) with confirm step; “Rescheduled from …” on event page; cancel confirm; stale nominal update warns when candidates are before new date.
- **Tests:** `reschedule-confirmed.test.ts`; notification presentation/types.

## 2026-10-13 — App version footer (0.9.0)

- Global footer `Hui vX.Y.Z · <sha>` from `package.json` + `buildStamp()`; `docs/RELEASING.md`; profile Build line folded into footer.

## 2026-10-13 — Stale proposing events

- **Cron:** `process_stale_proposals` in planning cycle worker — organiser in-app nudge when nominal passes; auto-cancel after 3-day grace; snapshot refresh on cancel.
- **RPC:** `reschedule_proposing_event_nominal`; migration `20261013191745` (applied linked Supabase 2026-10-13).
- **App:** stale banner on event page; home card “Date passed”; propose flow Time step date editable.
- **Tests:** `stale-proposal.test.ts`, `stale-proposals.test.ts`.

## 2026-10-13 — Lifecycle gaps (Tier 1)

- **Recurring card:** `cycleDisplayTargetDate` — “Planning around” uses active cycle nominal while a proposal is open (not the following open slot).
- **Auth:** `signOutAction` uses global sign-out + `unstable_rethrow` so redirect does not surface as “This page couldn’t load”.
- **Tests:** planning-cycle display target assertion; no migration.

## 2026-10-13 — HUI-031-D Planning cycle cron + nudges

- **Cron:** `GET/POST /api/internal/planning-cycle/cron` (Bearer `CRON_SECRET`); Vercel schedule 08:30 UTC; refreshes snapshots in app, `enqueue_planning_cycle_nudges` RPC.
- **Migration:** `20261013183230` — `planning_cycle_opens` notification kind.

## 2026-10-13 — HUI-031-C Nominal preview + cadence edit

- **Domain/UI:** `buildNominalDatePreview` (4 upcoming nominals); group recurring card preview; admin cadence form; header propose hidden when paused; first-proposal nominal prefill.
- **RPC:** `update_group_recurrence_cadence`; migration `20261013172849` (applied linked Supabase 2026-10-13).

## 2026-10-13 — HUI-031-B Pause, skip, snapshot refresh

- **Schema/RPC:** `group_recurrence_preferences`, `group_planning_cycle_skips`, `group_planning_cycle_snapshots`; `set_group_recurrence_paused`, `skip_group_planning_cycle`, `upsert_group_planning_snapshot`, `refresh_all_group_planning_snapshots` (stub); migrations `20261013105417`, `20261013105855` (applied linked Supabase 2026-10-13).
- **Domain:** skip dates in `resolveCycleReferenceDate`; `recurrence_paused` phase.
- **UX:** group recurring card admin pause/skip; snapshot sync on skip/pause/complete.
- **Tier-2 QA (91a6cc2):** closed-cycle `afterClosedCycle` next nominal; completed events no longer block; hero time on completed; paused hides propose; skips listed for members; `useActionStateRefresh`; migration `20261013112545` (RPC-only writes under FORCE RLS).

## 2026-10-13 — HUI-031-A Complete event + cycle reference

- **RPC:** `complete_event` — confirmed → completed; creator or group admin/owner; migrations `20261013104702_hui_031a_complete_event.sql`, `20261013104928_hui_031a_complete_event_trigger.sql` (applied linked Supabase 2026-10-13).
- **App:** manage lifecycle “Mark hui completed”, `completeEventAction`, domain permissions/lifecycle helpers.
- **Tests:** `events-complete.test.ts`, planning-cycle confirmed-future vs completed cases.

## 2026-10-13 — HUI-031-D Recurring cycle engine (design)

- **Deliverable:** `docs/design/HUI-031-recurring-cycle-engine.md` — end-to-end loop, sketched migration/RLS, generation/idempotency/TZ, reuse map, UX touchpoints, product questions, implementation split (031-A–D).
- **No app or migration changes.**

## 2026-10-13 — HUI-022A.6 hydration + respond bring step

- **Hydration (#418):** server-preformatted time labels for `EventScheduling`, respond flow, and decision poll decided dates; `EditEventForm` datetime-local defaults formatted in `EventDetailManagement`; event hero dates via `buildEventHeroDateCopy` + `EventHeroDateBlock` (client-only relative chip).
- **Host swap:** inline two-step confirm (`Ask to swap` → `Yes, step back` with `acknowledge_no_replacement`); dropped native `confirm()`.
- **Respond flow:** skip “What are you bringing?” when no open slots and viewer has no claim; `formatViewerContributionLine` avoids `Dessert — Dessert`.
- **Tests:** bring-step, host-swap form, hero dates, contribution line; `npm run validate` (placeholder Supabase env for build).

## 2026-10-13 — HUI-022A.5 host swap + contribution seed scope

- **DB:** `20261013150000_hui_022a5_host_swap_contribution_seed.sql` — `sync_host_bound_contributions` no longer calls `seed_event_contributions`; `host_swap_has_replacement`; vacant swap notifies event creator (`host_declined` + push-eligible dedupe `host_vacant:…`). Applied production `xmvzzypefpiethefrfka`.
- **App:** swap redirects to hui page `?host_swapped=1`; `HostSwapRequestForm` warns when no replacement; server enforces `acknowledge_no_replacement`.
- **Tests:** `coordination-hui-022a5.test.ts`; updated A.3/A.4 contribution setup. `npm run validate` + build (CI env).

## 2026-10-13 — HUI-003A-T1 QA tier 1 cleanup

- **Event summary:** multi-time hui hero/attention uses `bestViewerResponseAcrossProposedCandidates` (Yes > Maybe > No) instead of `focusCandidate` only.
- **Hydration (#418):** respond flow initial step always `"time"` then reads hash in `useEffect`; `formatEventTimeRange` / `formatCompactEventTimeRange` delegate to fixed `en-NZ` display helpers (avoids Node vs browser `dateStyle` drift on event scheduling + respond).
- **ROADMAP:** production-from-`main` + per-ticket branches; HUI-023 merged note; 003A migration version mismatch + `supabase migration repair` recommendation.
- **Tests:** `participant-flow.test.ts`; `npm run validate`.

## 2026-10-13 — Merge `feat/hui-026u-visual-design-system` → `main`

- **Shipped on main:** HUI-ONBOARDING-003 / 003A / 003A-R1 (repair 2), plus prior 026U–028 work on the feature branch (`02d324d` tip before merge docs commit).
- **Production:** Supabase `hui_onboarding_003a_planning_qa_fixes` applied; Vercel production `02d324d` (`dpl_9H16ZBjP1iyys21odPK963xhf9QS`) — see earlier entries same day.
- **Product (Isaac, 13 Oct):** After confirm, a **host proposal** may still appear when the organiser did **not** use “I'll host” (host switch off) — **intended**; group can accept/decline/swap as usual.

## 2026-10-13 — HUI-ONBOARDING-003A-R1 Repair 2 (live QA)

- **Respond Yes glyph:** `AttendanceChoice` hides the corner check on `AttendanceDot` until the option is saved-selected (fixes “Yes” looking picked before tap / during Saving on single- and multi-time respond).
- **Contribution copy/UI:** disclosure summaries count **requested slots** (`event_contributions` rows), not all group categories; hide “What to bring” when food is **No** or nothing was requested; section copy says nothing was requested instead of “Everything is covered”.
- **Confirm → extra categories (not fixed here):** if linked Supabase still runs `finalise_event` from `20261006220000`, it calls `seed_event_contributions` on confirm. **003A** removes that in `20261013100000_hui_onboarding_003a_planning_qa_fixes.sql` — apply that migration to stop confirm injecting Dessert/Drinks/Salad. Host accept still runs `sync_host_bound_contributions` → `seed_event_contributions` (`20261003220000_host_bound_contribution_sync_on_accept.sql`); separate product/DB decision if that should be scoped to requested categories only.
- **Multi-time summary (reported):** event page `viewerResponse` comes from `focusCandidate` only (`event-page-data.ts`), not an aggregate across candidates — can show “maybe” when another time is Yes.
- **Tests:** `display.test.ts`; `npm run validate`.
- **Deploy:** none.

## 2026-10-13 — HUI-ONBOARDING-003A-R1 Contributions display + respond Yes tick

- **Contributions:** `buildContributionSlots` only surfaces categories that have an `event_contributions` row for that hui (fixes respond “What are you bringing?” and event contribution UI listing every group category when only a subset was requested at propose). Propose validation drops contribution requests when food involvement is **No**; review step clears requested contributions when organiser picks No.
- **Respond attendance:** No optimistic checkmark or step advance until `setAvailabilityResponseAction` succeeds; `AttendanceChoice` hides the tick while pending.
- **Existing gatherings:** Unchanged when rows already exist (legacy full seed, host-bound sync, or 003/003A requested categories). Huies with **no** contribution rows no longer show phantom open slots.
- **Tests:** `slots.test.ts`, `display.test.ts`, `proposal.test.ts`; `npm run validate` (611 unit tests; build with CI placeholder Supabase env).
- **Migration / deploy:** none (app-only).

## 2026-10-13 — HUI-ONBOARDING-003A Planning workflow QA fixes

- **Host on finalise:** `coordinate_event_host_after_attendance` required attendance on `proposed` candidates only; after finalise the selected time is `selected`, so host coordination no-op'd. Fixed in `20261013100000` to count `selected` when the event is `confirmed`.
- **Contributions at setup:** optional request picker moved to the **Time** step (`ProposalContributionRequestFields`); finalise no longer calls `seed_event_contributions` (avoids copying every group category onto the hui when only a subset was requested at propose).
- **Respond race:** global `isSavingAttendance` dropped rapid saves for a second candidate; per-candidate pending state allows concurrent saves.
- **Recurring validation:** `starts_on` now falls back to `planningTargetDate` / cycle target when the cadence anchor is empty (QA 002A recurring propose).
- **Duplicate cycle (item 5):** rejection when `planning_target_date` already has an open proposing hui is **expected** duplicate-cycle protection (see `recurring-planning-hui-028` / `hui-onboarding-003a` test).
- **Tests:** `hui-onboarding-003a-planning-qa.test.ts`, `proposal.test.ts`, `proposal-defaults.test.ts`; `npm run validate` — 610 tests, build OK.
- **Migration:** `20261013100000_hui_onboarding_003a_planning_qa_fixes.sql` pending on linked Supabase (not applied this ticket). `20261006220000` unchanged on disk; apply order 003 → 003a when promoting DB.
- **Deploy:** none (per ticket).

## 2026-10-12 — HUI-ONBOARDING-003 Event planning workflow

- **Root causes:** gathering invite only on `?proposed=1`; no contribution slots at propose; recurrence series overwritten on later proposals; host auto-proposed on every `event_responses` write; respond flow single-candidate; first-hui host dropdown implied hosting on attendance; food-involvement fieldset legend overflow on small screens.
- **Schema:** `20261006220000_hui_onboarding_003_event_planning_workflow.sql` — drop host-on-response trigger; `commit_proposer_as_confirmed_host`, `apply_proposal_contribution_requests`; extend `propose_group_event`; preserve canonical recurrence; `finalise_event` proposes host when none accepted.
- **App:** propose review — optional contributions, “I'll host”, food UI fix; event detail invite for organisers while proposing; multi-candidate respond step.
- **Tests:** `hui-onboarding-003-planning-workflow.test.ts`, `proposal-contributions.test.ts`; updated host-selection + `propose_group_event` call sites.
- **Migration:** applied via PGlite in `npm run validate` only (not pushed to linked Supabase in this session).
- **Manual QA:** full invite E2E with two active gatherings; browser authenticated integration not run in CI.

## 2026-10-06 — HUI-ONBOARDING-002B QA failures (invite, dates, routing)

- **Root causes:** signed-out `/join/[token]` called `group_settings` under member-only RLS → thrown error → HTTP 500; calendar dates formatted via UTC-noon + group TZ shifted NZ dates forward one day; gathering invites shared the group link without `?event=` so `resolve_group_invite` and post-join routing preferred newest active hui.
- **Schema:** `resolve_group_invite(p_token, p_focus_event_id)` returns `groupTimeZone` + optional focus gathering (`20261006210000_hui_onboarding_002b_invite_and_dates.sql`); applied to linked Supabase.
- **App:** date-only `formatDateOnlyDisplay`; gathering invite URLs append `?event=` from propose-hui share; join/sign-in preserve focus; post-join redirect prioritises focus event; event cards label proposed times; dashboard uses full display name; profile shows build SHA; sign-up copy matches optional confirmation flow.
- **Host auto-suggest on respond:** unchanged — `trg_maybe_propose_event_host_on_response` / `coordinate_event_host_after_attendance` (product decision pending).
- **Tests:** `date-only.test.ts`, invite presentation/urls/resolve, `group-invite-links` focus + timezone, `post-join-redirect` ordering; `npm run validate` pass.
- **Deploy:** not promoted to production (per ticket). Production at ticket start was `3e9e67b`; fix lands on branch after push.
- **Manual QA:** signed-out invite link, two-active-gathering invite from propose-hui share (not group-only link), recurrence date entry 2 Nov / 9 Nov, host-suggest behaviour.

## 2026-10-06 — HUI-ONBOARDING-002A First-Hui onboarding correction

- **Schema:** `20261006200000_hui_onboarding_002a_corrections.sql` — idempotent `gathering_type` columns; `propose_group_event` writes gathering atomically; `group_settings` canonical FK fixed (no composite SET NULL on `group_id`); `_delete_group_cascade` deletes `group_settings` before series; PostgREST `reload schema`.
- **Root causes:** remote DB missing `20261006180000` (PostgREST cache / unapplied migration); group delete failed when `recurrence_series` delete triggered composite FK SET NULL on `group_settings.group_id`.
- **Product:** group create → first hui propose → invite (group link shows planning preview); optional gathering name; single first-cycle planning date for new recurring groups; invite copy “help plan … with {group}”; join still establishes membership + coordination redirect.
- **Tests:** group delete with recurrence, gathering invite title helpers, updated RPC signatures; `npm run validate`.

## 2026-10-06 — HUI-ONBOARDING-002 Frictionless participant & event context

- **Audit:** no reusable gathering-type field (only `eventKind` one-off/recurring + `food_involvement`); group-only invite RPC; post-join redirect to group page; `SuggestedTimesList` uses standing availability at propose time (not live re-rank after each response); recurring UX duplicated cadence anchor vs candidate dates; auth `useActionState` cleared fields on failed submit; contribution bring step requires open category (QA “only claimed items” = no open slots, not missing claim UI).
- **Schema:** `gathering_type` enum + `gathering_type_custom` on `events`; extended `resolve_group_invite` with inviter + active planning snapshot (`20261006180000_hui_onboarding_002_gathering_invite.sql`).
- **UX:** rich `/join/[token]` preview + “What is Hui?” card; “Join the planning” CTA; post-join → `/events/[id]/respond` when coordination open; proposal “What are you planning?”; recurring cadence vs proposed-time copy; polls terminology; availability copy aligned to behaviour.
- **Tests:** gathering/invite presentation, auth field preservation, proposal gathering validation, resolve payload; `npm run validate` pass.
- **Manual QA:** not run in session — use ticket QA-A–E runsheet.
- **Deferred:** event-specific invite tokens; inviter attribution beyond link `created_by`; mandatory manual QA sign-off.

## 2026-10-05 — HUI-ONBOARDING-001 First Hui onboarding hardening

- **Audit addressed:** group/hui conflation on invite/join/share copy; first proposal defaulting to recurring; missing post-propose orientation; personal setup discarding display name on skip and home on Continue; no first-run Group vs Hui explainer.
- **Decisions:** first-hui one-off when `groupHasEstablishedRecurrence` is false (cadence parts or canonical series); existing cadence unchanged; post-propose via `?proposed=1` + state-aware `buildProposedHuiGuidance`; setup home/name via `parsePersonalSetupFormData` on skip/complete (no forced tutorials).
- **Tests:** `proposal-defaults.test.ts`, `proposed-guidance.test.ts`, `personal-setup-update.test.ts`, `terminology.test.ts`; full `npm run validate` pass.
- **Manual QA:** not run in implementation session — use ticket runsheet A–D.
- **Deferred (explicit):** group cadence UI, demoting user-ID invites, suggested-times → availability link, join deep-link to active hui, email invites, PWA/push placement, recurrence weekday polish, full onboarding E2E suite.
- **Migration:** none.

## 2026-10-05 — HUI-026 Explainable time recommendations

- **Model:** `rankTimeRecommendations` in `src/domain/scheduling/time-recommendations.ts` — event response > standing signal > unknown; bounded slot generation around `planning_target_date` / 14-day fallback; deterministic sort; max 3 suggestions with human explanations.
- **Privacy:** standing availability stays owner-only (RLS unchanged); `loadProposalTimeRecommendations` verifies active membership then reads standing via server secret client; UI receives aggregate slots + copy only.
- **UX:** `SuggestedTimesList` on propose-hui Time step; proposer can use, ignore, or manually add times.
- **Tests:** `time-recommendations.test.ts`, `time-recommendations-hui-026.test.ts` (RLS + aggregate payload).
- **Migration:** none.
- **Deferred:** recommendations on existing hui scheduling section; full weekday/window recurrence inputs; auto-propose candidates.

## 2026-10-05 — HUI UX follow-up: member decisions + Manage Hui navigation

- **Decisions:** `create_event_decision` now requires active group membership (not event manager); creators may edit drafts with zero responses; finalize/cancel unchanged (event manager). Main hui **Group decisions** card shows empty state + **Ask the group**; reuse 026F form.
- **Manage Hui:** sectional `DisclosureCard` hub with `#hui`, `#people`, `#time`, `#host`, `#place`, `#contributions`, `#decisions`, `#dietary` + `HashDisclosureOpener`; default section from planning attention heuristics.
- **Migration:** `20261005230000_hui_decision_member_create.sql`.
- **Tests:** extended `event-decisions-hui-026f.test.ts`; `permissions.test.ts`, `manage-navigation.test.ts`.

## 2026-10-05 — HUI-025 Persistent availability & preferences

- **Before:** only per-candidate `event_responses` (yes/no/maybe); no standing weekly preferences; respond flow always cold-start.
- **Data:** `group_member_standing_availability` + `standing_availability_kind` enum; owner-only RLS + membership trigger; migration `20261005210000_hui_025_persistent_availability.sql`.
- **Domain:** `standing-availability.ts` (window labels, overlap, hint inference; unavailable overlaps beat available).
- **UX:** Profile **Usual availability** hub + group **More → Usual availability**; `/events/.../respond` shows hint only when viewer has no response yet — explicit tap still required.
- **Privacy:** members cannot SELECT another member's standing rows; no new group-visible schedule surface.
- **Tests:** `standing-availability.test.ts`, `standing-availability-hui-025.test.ts`.
- **Deferred:** HUI-026 recommendation engine, calendar import, prefer/maybe standing tier, personal timezone override per window.

## 2026-10-05 — HUI-028 Recurring planning cycle

- **Before:** `recurrence_series` anchor per proposal only; no group cadence, planning window, cycle identity, or next-planning UX.
- **Data:** `group_settings` cadence + `planning_lead_days` + `canonical_recurrence_series_id`; `events.planning_target_date` with partial unique index; `propose_group_event` syncs cadence, reuses series, rejects duplicate cycle targets.
- **Domain:** `src/domain/recurrence/planning-cycle.ts` (phases, next target, planning opens, prefill).
- **UX:** Group hero card + dashboard **Recurring groups**; propose flow prefills recurring target date when derivable.
- **Tests:** `planning-cycle.test.ts`, `recurring-planning-hui-028.test.ts`; updated `event-proposal.test.ts` RPC arity.
- **Deferred:** event completion UI hook, skipped-cycle policies, weekday/time-window recurrence UX, planning push/email reminders, persistent availability (HUI-025).

## 2026-10-05 — HUI-026F Generic decision polls

- **Data:** `event_decisions`, `event_decision_options`, `event_decision_responses` with RLS + RPCs (`create_event_decision`, `respond_event_decision`, `finalize_event_decision`, `cancel_event_decision`, `update_event_decision_draft`); `_delete_event_cascade` extended.
- **UX:** Open decisions on main hui page + Details disclosure + Manage **Decisions** section; members tap options; managers record result (ties do not auto-select); `buildEventAttention` / home cards add `decision` after contribute.
- **Tests:** `src/db/event-decisions-hui-026f.test.ts`, `src/domain/decisions/display.test.ts`, attention/home path updates.
- **Deferred:** ranked/multi-choice polls, deadlines/auto-expiry, push notifications for decisions.

## 2026-10-05 — HUI-026C Home / event attention finish

- **Attention:** `classifyHomeEvent` delegates primary attention to `buildEventAttention` (same respond / host / confirm / contribute rules as event pages); `loadHomeData` supplies proposer `canConfirmTime` via `canFinaliseEvent` + `evaluateCandidateConsensus`, plus contribution claim state for contribute nudges.
- **Dashboard:** Sections **Needs attention** (only when items exist), **Upcoming** (featured + more confirmed), **Being planned** (proposal/consensus only); `/events` overview keeps parallel grouping; event cards link to `#scheduling`, `#host`, `#contributions` or `/respond`.
- **Validation:** `lint` / `typecheck` / **506 passed**, 2 skipped / `build` passed.
- **Manual QA:** Authenticated dashboard flows not run in agent env (sign-in required).

## 2026-10-05 — Production promote `2fb4519` (Manage Hui UX)

- **Production:** `npx vercel promote dpl_AND5pAfK3L521oF2c46wcUwr5r23` → `dpl_HBQC3mr94Lec8g8ZW4P5w6saWVA8` **READY** at git `2fb4519`; aliases https://hui-seven-gamma.vercel.app and https://hui-jimbook.vercel.app.

## 2026-10-05 — Manage Hui sectional UX (finish)

- **Problem:** Manage domains were grouped by `SectionHeader` + `HuiSurface`, but legacy section components still rendered nested `hui-card-section` surfaces and duplicate h2 titles — the page read as one long list.
- **Fix:** `ManageDomainSection` + `.hui-embedded` on manage surfaces (same pattern as `DisclosureCard`) so Time, Host, Contributions, Dietary, and lifecycle forms flatten inside each domain card; `space-y-6` between domains; semantic `section` + heading ids.
- **Verification:** `lint` / `typecheck` / 502 tests / `build` passed. Authenticated mobile browser smoke not run in agent env.

## 2026-10-05 — Contribution notification noise fix

- **Problem:** Row-level contribution INSERT/DELETE triggers notified every group member and queued Web Push for each mutation (claim, release, assign, reassign, clear), producing duplicate “claimed” / “slot changed” interrupts.
- **Fix:** Migration `20261005180000_contribution_notification_policy.sql` — targeted coordinator in-app notifications from contribution RPCs; assignee-only selective push with per-event coalescing; `queue_member_notification` `p_deliver_push` flag; removed `event_contributions_notifications` trigger.
- **Tests:** `src/db/contribution-notifications.test.ts` (rapid production-style sequence).
- **Deploy / verify (2026-10-05):** `npx supabase db push --dry-run` showed only `20261005180000` pending; `npx supabase db push` applied; `migration list` local/remote aligned on `20261005180000`. Remote DB: no `event_contributions_notifications` trigger; `notify_contribution_*` helpers present; all five contribution RPCs call them; `queue_member_notification` includes `p_deliver_push`. Vercel Preview **READY** `dpl_G1Wzpa7NfgXsuBiT83nGCyRtCiHs` — https://hui-git-feat-hui-026u-visual-design-system-jimbook.vercel.app (branch alias; git `2f58db6` on `origin`). Production alias https://hui-seven-gamma.vercel.app still serves older production deployment `dpl_BjTj93uVXANo1tKnKGsmyBZ6Zcr4` (pre-`2f58db6`); policy is database-side so linked Supabase carries the fix for production app traffic. **Manual push QA not run** — no authenticated Web Push device/session in agent env.

## 2026-10-05 — HUI-026E Contribution coordination finish

- **Member UX:** per-category contribution cards with clear status (open, claimed, yours, host-bound, manager-assigned) on hui detail, manage, and respond **What are you bringing?** steps.
- **Coordinator tools:** `assign_event_contribution_as_manager`, `reassign_event_contribution_as_manager`, `release_event_contribution_as_manager` (creator or group admin/owner); host-bound categories stay on accepted-host sync.
- **Standing preferences:** group admins set optional **Usually brings this** (`default_assignee_user_id`) without rewriting past events.
- **Claims:** members claim into existing open seeded rows; manual claims blocked on host-bound categories.
- **Tests:** `src/db/contributions-hui-026e.test.ts`, `src/domain/contributions/slots.test.ts`.
- **Migration:** `20261005160000_hui_026e_contribution_coordination.sql`.
- **Deferred:** per-hui contribution category overrides; full GDD standing-preference matrix beyond default assignee.
- **Verification (autonomous):** `npx supabase db push` applied `20261005160000` to linked project; remote RPCs confirmed; `lint` / `typecheck` / 497 tests / `build` passed; Vercel Preview deployment for `d4c9848` **READY** (`https://hui-re8xmgfps-jimbook.vercel.app`). Authenticated browser smoke not run in CI (no `E2E_TEST_*` in agent env).
- **Finish pass:** unclaimed slots sort first on detail/manage/respond; disclosure summaries use filled slot counts (`claimedContributionCount`); concise “All set” copy when every category is covered; release/unauthorised-release DB tests in `contributions-hui-026e.test.ts`.

## 2026-10-05 — UX foundation correction (pre–HUI-026E)

- **Manage discoverability:** authorised viewers see a dedicated **Open manage hui** card on the main hui page (not only a small Details header link).
- **Manage layout:** `/events/[eventId]/manage` grouped into Hui, People & attendance, Time, Host, Place, Contributions, and Dietary sections.
- **Host place:** accepted host gets **Set the place** / **Change place** on the main hui hero; manage Place reuses the same host location form with **At my home** (no address search when home is selected).
- **Propose flow:** recurring groups default to **Recurring** planning model; one-off remains an explicit radio alternative.
- **Theme:** `ThemeSystemSync` + shared `theme-client` helpers so **Match device** follows `prefers-color-scheme` while open; explicit light/dark unchanged.
- **Next:** **HUI-026E** contribution coordination finish (not started in this pass).

## 2026-10-05 — HUI-026D Hui management & admin surface

- **Manage route:** `/events/[eventId]/manage` (mobile-first sections reusing existing scheduling, host, contribution, and edit components). Participant `/events/[eventId]` unchanged except a **Manage this hui** entry for authorised viewers.
- **Permissions:** `canAccessEventManagement` (creator/admin edit/cancel/delete, or accepted-host place edit). Delete: creator or group owner/admin only (`canDeleteEvent` + `delete_event` RPC).
- **Delete:** `_delete_event_cascade` + `delete_event`; `events_delete` RLS policy; PGlite tests in `src/db/events-delete.test.ts`. Cancel remains non-destructive.
- **Deferred:** per-hui contribution category overrides (still HUI-027/GDD backlog).
- **Migration:** `20261005140000_hui_026d_delete_event.sql`.

## 2026-10-05 — HUI-027 Onboarding & setup architecture

- **Audit:** User vs Group vs Hui ownership documented in `ROADMAP.md`; contribution categories remain group templates with per-event `event_contributions` (no per-hui category override yet).
- **User:** `/profile/setup` + dashboard prompt; `/profile/home` for saved home; `personal_setup_completed_at` on profiles.
- **Group:** `/groups/new` wizard (name → invite link → hosting/maybe toggles → propose CTA); owner `delete_group` RPC + UI.
- **Host accept:** “At my home” / “Somewhere else” when profile home is set.
- **UI:** `HuiSwitch` + checkbox→switch pass on group settings, notifications, contributions, propose review.
- **Deferred:** hard event delete (no delete RLS) → **HUI-026D**; standing contribution preferences → GDD backlog.
- **Migration:** `20261005120000_hui_027_profile_home_delete_group.sql`.

## 2026-10-05 — HUI-026U.4 final production polish

- **Host accept:** `host_place_required` on events; accept flow uses `EventLocationFields` (confirm vs choose copy); `respond_to_host_assignment` optionally persists place atomically on accept.
- **Maps:** address-first Open in Maps; map/pin opens when address or coordinates exist (no extra toggle).
- **Food step:** mobile overflow fix on “Will food be involved?”
- **Production:** accepted-host location edit verified on https://hui-seven-gamma.vercel.app (manage → confirm place, persist, participant read-only).

## 2026-10-05 — HUI-026U.4 host place persistence (release fix)

- **Gap:** accepted host UI/actions allowed place edits but RLS blocked direct `events` updates for non-creators.
- **Fix:** `update_event_place` RPC (migration `20261005040000_accepted_host_update_event_place`); `updateEventAction` routes host-only saves through RPC; PGlite tests in `host-event-place.test.ts`.
- **Deploy:** `supabase db push` on `xmvzzypefpiethefrfka`; Vercel production `dpl_CB7Zgr7cCM3276dRR2gj8HDB8rL3` → https://hui-seven-gamma.vercel.app (git `b67ffb3`).

## 2026-10-05 — HUI-026U.4 final polish (sign-off)

- **Geoapify:** global autocomplete with `bias=countrycode:auto` on every request; optional `bias=proximity:lon,lat` when the user already has a map pin (`proximityLat`/`proximityLng` on `/api/geocode`). No default country filter.
- **Address UI:** clearer vertical separation between place text and **Open in Maps** on the event hero.
- **Notifications:** post-install dashboard onboarding card (enable / not now; denied → settings link); shared `enableWebPushNotifications` client helper; dismiss cooldown matches PWA install card.
- **Propose flow:** time step uses **Continue** with implicit candidate from the picker; **Add another time** is secondary.
- **Food involvement:** responsive legend/options wrapping; selected state uses sage tint + primary border + check (readable light/dark).
- **Validation:** `npm run validate` (lint, typecheck, tests, build) passed.
- **Production smoke:** re-verify address search (incl. `50 Kent Lodge Avenue, Avonhead, Christchurch`), time/food/notifications UX on `https://hui-seven-gamma.vercel.app` after deploy.

## 2026-10-05 — HUI-026U.4 production deploy (partial)

- **Deploy:** Vercel production `https://hui-seven-gamma.vercel.app` — deployments `dpl_CyY3uj3x9Vo48MAxPF7BQ5sV2nHP` then `dpl_*` (second deploy for env); git `d2add56` (Geoapify attribution + prior geocoder adapter).
- **Vercel env:** `HUI_GEOCODING_PROVIDER=geoapify` set on Production, Preview, and Development. **`HUI_GEOCODING_HTTP_KEY` not set** (no Geoapify key in repo, `.env.local`, or Geoapify login session).
- **Live smoke:** authenticated `/` → `/dashboard`; signed-out `/` shows landing; `/profile` hub loads; `/api/geocode?q=Wellington%20Cuba` returns `configured:false` until API key added; proposal form shows address search field (manual pin still available).
- **DB:** `events.food_involvement` confirmed on linked production.
- **Blocked for U.4 sign-off:** add free-tier Geoapify API key to Vercel, redeploy, re-test autocomplete + food UI on production.

## 2026-10-05 — HUI-026U.4 follow-up (production geocoder + migration)

- **Geocoder:** Geoapify Address Autocomplete adapter (`GeoapifyGeocodingProvider`); configure `HUI_GEOCODING_PROVIDER=geoapify` and `HUI_GEOCODING_HTTP_KEY` (server-only). Chosen for NZ address search, commercial terms, low early-scale cost (3k credits/day free tier), no MapLibre coupling; `HttpGeocodingProvider` retained for custom backends.
- **Migration:** `supabase db push` applied `20261005030000_event_food_involvement.sql` on linked production `xmvzzypefpiethefrfka`.
- **Manual:** Add Geoapify API key to Vercel production/preview env before expecting autocomplete in deployed builds.

## 2026-10-05 — HUI-026U.4 UX refinement

- **Entry:** signed-in users hitting `/` redirect to `/dashboard` (middleware + server redirect); unauthenticated landing unchanged; PWA `start_url` still `/`.
- **Profile hub:** `/profile` is a settings hub; sections at `/profile/account`, `/profile/groups`, `/profile/hosting`, `/profile/dietary`, `/profile/notifications`, `/profile/appearance`, `/profile/install` with back navigation to Profile.
- **Maps:** address search seam (`src/lib/maps/geocoding.ts`, optional HTTP provider env), `GET /api/geocode`, `AddressSearchField` + `EventLocationFields` on propose/edit; **Open in Maps** link from stored place/coordinates.
- **Host place:** accepted host may confirm location (`canEditEventLocation`) without full manage rights; proposal copy de-emphasises proposer pin when hosting is on.
- **Dietary:** sharing controlled at global + per-group scope (existing DB flags/shares); per-entry share UI removed; multi-group summary bug fixed.
- **Food involvement:** `events.food_involvement` (yes/no/unsure) on new proposals; event dietary section hidden when `no`; legacy null unchanged.
- **Migration:** `20261005030000_event_food_involvement.sql` (apply before deploy).

## 2026-10-05 — HUI-026U.3 follow-up (ship with production DB)

- **Attendance after confirmation:** members can change Yes/Maybe/No on the confirmed time (`set_availability_response` + `attendance-override` domain rules); respond flow and `AttendanceLive` on event detail; DB tests in `attendance-after-confirmation.test.ts`.
- **Optional event end time:** proposals, candidates, and confirmed events may omit `ends_at`; validation and display updated across scheduling and proposal flows.
- **Real event map:** MapLibre GL JS (`src/components/map/`, `src/lib/maps/config.ts`) with replaceable tile/style provider (default OpenFreeMap via env); geocoding helper; event hero + `EventLocationPanel` use coordinates when present; location picker on propose/edit. Worker assets copied at `prebuild` (`public/vendor/` gitignored).
- **Gathering / brand:** `HuiLogo`, refreshed PWA manifest icons (maskable + apple-touch), push notification badge asset, forest-green map styling in `globals.css`.
- **PWA install:** `InstallHuiPrompt` + `install-store` (beforeinstallprompt / iOS guidance); manifest name/shortcuts updated.
- **Dietary:** profile “Share with all groups” scope (`dietary_entry_shares` sentinel group + app actions); `dietary-all-groups.test.ts`.
- **Migrations** (already applied in production before app deploy): `20261005000000_optional_end_time_and_location_coordinates`, `20261005010000_attendance_changes_after_confirmation`, `20261005020000_dietary_share_with_all_groups`.
- HUI-026P optimistic attendance, respond primary/deferred split, and Suspense shells unchanged.
- `npm run lint`, `npx tsc --noEmit`, `npm test` (444 passed, 2 skipped), `npm run build` passed.

## 2026-10-04 — HUI-026U redesign (full UI/UX rewrite)

- Redesigned every route from the reference screens: forest/clay/blue tokens (light + dark), ~32px organic shapes, no bordered cards or dividers. Theme preference is device-local (`hui-theme` in localStorage, set in Profile → Appearance).
- New IA: bottom nav Home / Hui (`/events`) / Groups / Alerts / You (`/profile`); `/events` lists all gatherings; `/events/new` is a group picker into the existing `/groups/[id]/events/new` proposal flow.
- Event detail: static map hero, answer strip, "Who is coming" gathering visual, attention card, then a "Details" disclosure list (times, hosting, bring, dietary, members, about, manage). `HashDisclosureOpener` keeps `#host` / `#contributions` / `#scheduling` deep links working.
- Respond (HUI-026B stages + P optimistic attendance) and proposal (HUI-026A: Name → Time → Review) re-skinned; logic unchanged.
- Profile gains per-group hosting preference (existing `setMyHostingStandingAction`) and theme toggle.
- Fixed pre-existing bugs found in QA: locale-dependent date formatting caused hydration mismatches (`formatInstantInTimeZone` now fixed to en-NZ); respond flow called `.catch` on a streamed promise (crashed page).
- No Supabase schema/RLS/server action/lifecycle changes. `npm run validate` passed. Checked 360/390/412/1280 light + 390 dark: no horizontal overflow.

## 2026-10-04 — HUI-026U.2 visual reference integration

- Located reference mockups and brand assets at repo root; indexed in `docs/reference/REFERENCE_INDEX.md`.
- Shifted primary palette from terracotta to reference forest green; added date badge, `HuiGatheringMark`, refined gathering/location/shell from `example-screen-*` and logo files.
- Brand wordmark in `public/brand/`; production deploy `dpl_3Jq5HKEorhtnUnwoc21upe52Nn8L` **READY** — https://hui-seven-gamma.vercel.app (git `69b1515`).

## 2026-10-04 — HUI-026U visual design system & UX foundation

- Warm token system in `globals.css`, Hui primitives under `src/components/hui/`, documented in `docs/DESIGN_SYSTEM.md`.
- Gathering ring (`GatheringVisual`) wired to real `AttendanceRoster` data on event detail and scheduling; static `EventLocationPanel` for place context (no map SDK).
- Mobile bottom nav + refreshed shell, groups, dashboard, notifications, profile sections, respond/detail primary actions.
- HUI-026P.2 optimistic attendance and P.3 Suspense/loading paths unchanged.

## 2026-10-04 — HUI-026P.3 navigation & data-loading performance

**Before:** Respond route awaited full `getGroupDetail` (member roster), host history, contributions, and categories before first paint. Groups page and AppShell blocked on group list / notification unread queries.

**After:** `loadRespondPrimary` + deferred contribution data; groups shell streams list via Suspense; notification badge streams in AppShell; respond/groups `loading.tsx` shells.

**Measurements:** Android before from ticket (~4–5s); after requires device + `hui_perf=1` on new deploy.

- `npm run validate` passed.

## 2026-10-04 — HUI-026P.2 end-to-end interaction latency audit

**Finding:** Server query improvements in P/P.1 did not fix perceived slowness because several flows still blocked visible acknowledgement on server completion + RSC refresh. Attendance waited for `setAvailabilityResponseAction` (including `getEventDetail`) before `pushStep`; notification Open awaited mark-read before `router.push`.

**Instrumentation:** `src/lib/perf/client-interaction-perf.ts` (`?hui_perf=1`), `InteractionPerfBootstrap`, extended `HUI_DEV_PERF` spans on `setAvailabilityResponseAction`, audit doc `docs/performance/HUI-026P.2-audit.md` with Android procedure.

**Fixes:** Optimistic attendance UI (immediate selected state + step advance, deferred `router.refresh`, rollback on error); notification navigate-first; profile `loading.tsx`; form save perf marks.

**Not changed:** Heavy `getEventDetail` inside attendance action; dietary list still uses deferred `router.refresh`; Vercel `iad1` vs Supabase region unconfirmed in dashboard.

- `npm run validate` passed.

## 2026-10-04 — HUI-026P.1 systemic latency (common paths)

**Diagnosis (code + architecture; Android timings from ticket, not re-measured in Cursor):**
- Protected navigations repeated `auth.getUser()` in middleware, layout, page, and `NotificationsNavLink` (AppShell on every screen) — each call is a Supabase Auth round trip.
- Protected layout always ran `ensureUserProfile` (extra `profiles` read) even when the layout’s own profile guard query already proved the row exists.
- Profile page loaded households via `listUserHouseholdsByGroup` with an **N+1** pattern (per-group sequential `household_members` / `households` / members queries) and duplicated active `group_memberships` reads for dietary + household sections.
- Save display name: server action + `revalidatePath` + `router.refresh()` refetched the full heavy profile RSC tree after success.
- Dietary saves use the same `refreshOnSuccess` pattern (deferred refresh after success message).

**Fixes:**
- `getServerAuthUser` / `getServerSupabase` (`React.cache`) — one auth + client per RSC request across layout, page, and shell.
- Skip `ensureUserProfile` when the layout profile row already exists.
- Batch household loading; share one `listActiveMembershipGroups` fetch across household + dietary on profile.
- Profile display name: removed `refreshOnSuccess` and unnecessary `/dashboard` revalidation; success from action state only.
- `AuthForm` defers `router.refresh()` to the next task so success copy paints first.
- Dev timing labels on profile layout/page, dietary actions, display-name action, event/respond routes (`HUI_DEV_PERF=1`).

**Region note:** Supabase project host `xmvzzypefpiethefrfka.supabase.co` (from prior OAuth QA). Confirm exact Supabase region in dashboard; Vercel production region not queried (API scope). Cross-region latency may still contribute on NZ mobile — needs correlation with physical traces.

**Physical Android verification:** still required for profile open, display name save, dietary save, notification → respond, 026B flow.

- `npm run validate` passed (incl. new `src/lib/households/queries.test.ts`).

## 2026-10-04 — HUI-026P performance audit + fixes

**Baseline (observed / code-traced bottlenecks):**
- Event and respond routes blocked on long server waterfalls: sequential `getEventDetail` → `getGroupDetail` → large `Promise.all`, then per-candidate `candidate_attendance_roster` RPCs on the full event page.
- Attendance Yes/Maybe/No felt multi-second because `useTransition` waited for `router.refresh()` (full RSC refetch) **before** advancing the respond flow; server action also loaded full `getGroupDetail` for one boolean setting.
- Group → events and notification → respond paths paid extra sequential round trips; no route-level loading UI during navigations.
- Protected layout still runs auth + profile ensure on every navigation (necessary; not changed).

**Fixes:**
- Parallelised independent Supabase reads in `getEventDetail`, `getGroupDetail`, respond page, and group events list.
- `setAvailabilityResponseAction` uses lightweight `getGroupResponseSettings` instead of full group detail.
- Event page streams heavy sections via `Suspense` + `loading.tsx`; shell (title, breadcrumbs, status) renders after a single event fetch.
- Respond flow advances step immediately after successful save; `router.refresh()` runs after UI acknowledgement.
- Dev-only timing logs: set `HUI_DEV_PERF=1` in development.

**Remaining risks:** Full event page still loads all coordination surfaces in one streamed chunk; multiple roster RPCs when many candidates; group detail page still loads full admin surface; physical Android re-measurement recommended on NZ mobile.

- `npm run validate` passed.

## 2026-10-04 — Member hosting standing “always”

- Migration `20261004120000_member_hosting_standing_always.sql`: enum value `always` on `member_hosting_standing`; `pick_host_candidate` prefers eligible `always` members before `default`, then unchanged `prefer_not` fallback and consecutive-host passes.
- Group settings UI: fourth option **I always host** (standing preference only; proposal/accept/swap lifecycle unchanged).
- Tests: `src/db/coordination-host-selection.test.ts` (persistence + selection). `npm run validate` passed.

## 2026-10-04 — HUI-026B invitee participation flow

- Added `/events/[eventId]/respond`: staged invitee flow (proposed time → attendance yes/maybe/no → place → contributions → done; declined and alternative-time branches).
- Reuses `event_responses` / `setAvailabilityResponseAction` and `event_candidates` for structured alternative times (no new attendance state).
- Participant-facing attendance copy (`Can come` / `Can't come` / …) separate from coordination-page labels.
- Web Push + in-app notification links for `event_proposed` and `consensus_ready` open the respond route; event page links participants into the flow.

## 2026-10-04 — HUI-026A Android date/time picker (production fix)

- Time step (and recurrence “Series starts on”) used visible native `date`/`time` inputs with `text-sm` styling inside labels. On Android Chrome the picker affordance is easy to miss and empty fields show unusable `mm/dd/yyyy`-style placeholders.
- Added `WallClockDateField` / `WallClockTimeField`: full-size transparent native inputs over NZ-friendly labels (`formatWallClockDateLabel` / `formatWallClockTimeLabel`), 44px tap targets, `text-base`, and `showPicker()` on user tap. Parsing, timezone, and candidate persistence unchanged.
- Tests: `src/domain/datetime/wall-clock-display.test.ts`. `npm run validate` passed.

## 2026-10-04 — HUI-026A staged event proposal

- Replaced single-page group event creation with a staged creator flow: Name → Time → Place → What to bring → Review → **Propose event**. Draft data stays client-side until submit; no partial group-visible event is created while the creator is still editing.
- Migration `20261004100000_propose_group_event.sql` — `propose_group_event` RPC atomically creates a `proposing` event, inserts candidate times, optionally sets first-event initial host, and leaves `events.starts_at` / `ends_at` unset until `finalise_event`.
- Time step uses separate `date` + `time` inputs and `formatCompactEventTimeRange` instead of `datetime-local` on the creation path. Event detail page: extracted `EventDetailSummary` and `EventDetailManagement` for later 026B–D work.
- Tests: `src/domain/events/proposal.test.ts`, `src/db/event-proposal.test.ts`. `createEventAction` retained for edits/legacy but no longer used on `/groups/[groupId]/events/new`.
- Deferred to HUI-026B–E: invitee response flow, dashboard cards, `/manage`, contribution redesign, full event page visual redesign.

## 2026-10-04 — HUI-026 architecture planning

- Architecture diagnosis: the current event page is a long-scroll “god page” combining summary, scheduling, responses, consensus, host coordination, dietary information, contributions, administration, and history.
- Decision: separate concise event summary, participant response, and proposer/admin management surfaces; use a staged creator flow (**Name → Time → Place → What to bring → Review → Propose**) and invitee flow (**This time → Answer → Place → What you're bringing → Done**).
- Direction: make the dashboard event-oriented around “What Hui things need my attention?” and require deterministic interaction feedback from acknowledgement through reconciled success/error, including investigation of latency, refreshes, query volume, re-renders, stale props, duplicate submissions, idempotency, and reconciliation.
- Planned implementation workstream: **HUI-026A–E** — event-flow foundation/proposal, invitee response, dashboard/event entry, management/admin surface, and contribution flow redesign.
- Existing GDD capability tickets **HUI-025–030 remain unchanged**; the event-flow work uses the HUI-026A–E sub-series and does not renumber historical tickets.
- No application code, database migrations, or tests were changed by HUI-026 architecture planning.

## 2026-10-04 — HUI-024 Web Push notification preferences

- Added five default-on profile preferences for event proposals, decision-ready, event confirmation, host assignment, and contribution changes. Profile settings can independently update them; the existing master Web Push control and browser permission flow are unchanged.
- Server-side `queue_member_notification` still creates every `member_notifications` row, but only creates a new Web Push outbox row when the recipient's matching category preference is enabled. Historical notifications and existing outbox rows are untouched.
- Migration: `20261004030000_push_notification_preferences.sql`.
- Validation: `npm run validate` passed — lint, typecheck, 301 tests passed / 2 skipped, and production build passed. Next.js reported its existing middleware-to-proxy deprecation warning.

## 2026-10-04 — HUI-023A Web Push finalisation

- Removed temporary failed-delivery diagnostics from the profile control, Web Push delivery path, and delivery test; restored the permanent generic browser error handling and `WebPushError` status normalization.
- HUI-023 production verification: canonical `member_notifications`, eligible push planning, safe outbox claiming, bounded retries, stale `sending` recovery, VAPID delivery, account opt-in, account-deletion subscription cleanup, notification click routing, signed-out `next` routing, cron backup drain, immediate drain, and no delivery for ineligible kinds.
- Confirmed production Android Web Push delivery at https://hui-seven-gamma.vercel.app. No VAPID keys, schema, architecture, or HUI-024 notification preferences changed.
- Validation: `npm run validate` passed — lint, typecheck, 299 tests passed / 2 skipped, and production build passed. Next.js reported its existing middleware-to-proxy deprecation warning.

## 2026-10-04 — HUI-023 production deploy

- Deployed `f0c35f8` to Vercel production without merging main. `dpl_6S5YZXGTMKnz14MwoYnG7N6o8dYQ` READY. Alias https://hui-seven-gamma.vercel.app. Smoke: `/` 200, `/sign-in` 200, `/profile` 307 to sign-in, `/serwist/sw.js` 200.
- Production env names present: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `CRON_SECRET`, `SUPABASE_SECRET_KEY`. No `PUSH_DELIVERY_SECRET`.
- Real browser Web Push delivery QA is still outstanding.

## 2026-10-03 — HUI-023

- Changed: Web Push on the existing HUI-021 records. Migration `20261004020000_web_push_notifications.sql` adds `profiles.web_push_enabled`, `push_subscriptions`, `notification_push_outbox`, and extends `queue_member_notification`. Profile setting subscribes this browser. Serwist service worker shows the push and opens the event, host, contribution, or group path. Sign-in `next` is unchanged.
- Architecture: in-app row is canonical. One outbox row per new notification. Server drain uses VAPID (`web-push`) after coordination writes (`after`) and via `GET/POST /api/internal/push/drain` (bearer `PUSH_DELIVERY_SECRET` or `CRON_SECRET`). Reconnect reminders are not pushed. Payload is id, title, body, and a same-origin URL. Stale 404/410 subscriptions are deleted; one failed device does not block the others.
- Env: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (`mailto:` or `https:`), existing `SUPABASE_SECRET_KEY`. No private key is committed. Without VAPID, profile shows push as unavailable and in-app notifications still work.
- Security: subscription and outbox tables have no client grants; RLS is forced; RPCs are `SECURITY DEFINER` with `search_path = ''`. Keys are not returned by `my_push_subscription_state`.
- Checked: `npm run validate` — lint, typecheck, 299 tests passed (2 skipped), production build. Built service worker still precaches `/offline` and includes `push` / `notificationclick` / `showNotification`. Linked `supabase db advisors --linked` was run before this migration is applied, so it does not cover the new tables. Migration is not applied to production in this change.
- Limits: no email/SMS; no push for share-link invites to non-users; no new cancel/reopen kinds; iOS Web Push needs an installed PWA; daily Vercel cron is only a backup.

## 2026-10-03 — HUI-022B

- Changed: migration `20261004010000_group_invite_links.sql` — `group_invite_links`, `get_group_invite_link`, `regenerate_group_invite_link`, `resolve_group_invite`, `join_group_via_invite` (token-validated membership via security definer RPC; no client-controlled group id). App: `/join/[token]`, group invite section (share/copy/regenerate), sign-up `next` + OAuth handoff, `invite-actions` / `join/actions`.
- Security: invite tokens are high-entropy secrets; invalid/revoked tokens return no group data; membership only through `join_group_via_invite`; admins/owners only for link create/regenerate (`is_group_admin`).
- Pre-deploy review (HUI-022B): HUI-022B definer RPCs use `set search_path = ''` with schema-qualified references; explicit `REVOKE` on `resolve_group_invite` / `join_group_via_invite` from `public` (join also from `anon`). Tests extended for join idempotency, execute privileges, and direct table access.
- Tests: `group-invite-links.test.ts`, `domain/invites/*`, `routes.test.ts`, `middleware-guard.test.ts`, `e2e/join-invite.spec.ts`. PGlite join RPC passed locally; still verify grants, RLS, and definer behaviour on linked Supabase before marking complete.
- Checked: `npm run validate` (272 passed, 2 skipped; build OK).
- MVP limits: no email/SMS, QR, named invites, expiring links, or invitation inbox; add-by-user-ID retained for admins.

## 2026-10-03 — HUI-022A.4

- Changed: `canRequestHostSwap` (proposed or accepted host); `EventHostSection` + event page pass `viewerUserId` / `canRequestSwap`; `requestHostSwapAction` uses new permission; migration `20261003230000_accepted_host_request_swap.sql` extends `request_host_swap` for `accepted` rows and fixes `contributions_before_write` so host-bound sync can clear assignee on swap. Tests: `coordination-hui-022a4.test.ts`, permissions + `queries.test.ts`.
- Checked: `npm run validate` (252 passed, 2 skipped).
- Commit: `cb726de` — pushed `main` (`80ab2d9..cb726de`); docs `0c08f27`.
- Deploy: `supabase db push` applied `20261003230000_accepted_host_request_swap.sql`; local/remote aligned through `20261003230000`.
- Production: Vercel `dpl_FiWiKS1PjbapfWh5pDD2M17pJ8ZV` **READY** — https://hui-seven-gamma.vercel.app (feature git `cb726de`); sign-in/profile HTTP 200; Supabase smoke passed.
- Manual: live Family Dinner Grok QA — next step.

## 2026-10-03 — HUI-022A.3

- Changed: `20261003220000_host_bound_contribution_sync_on_accept.sql` — `sync_host_bound_contributions` resolves `group_id` from the event, calls `seed_event_contributions` (insert-only for missing categories) before updating **host-following** rows so acceptance during `proposing` persists Main. PGlite regressions in `src/db/coordination-hui-022a3.test.ts`.
- Checked: `npm run validate` (247 passed, 2 skipped); explicit claims and default-assignee rows unchanged by seed (skip-if-exists); sync updates only `follows_host` categories.
- Commit: `2efc68b` — pushed `main` → `origin/main` (`5059f31..2efc68b`).
- Deploy: `supabase db push` applied `20261003220000_host_bound_contribution_sync_on_accept.sql` on `xmvzzypefpiethefrfka`; local/remote migration list aligned through `20261003220000`.
- Production: Vercel `dpl_6Q7t2jrpW3p3XQJYLYZnYxyUTF7S` **READY** — https://hui-seven-gamma.vercel.app (git `2efc68b06ca80a8c12bdc964913717d0dd0bec0c`); sign-in HTTP 200; Supabase `auth.getSession` smoke passed.
- Manual: **live Family Dinner Grok QA** — next step (not run in deploy session).

## 2026-10-03 — HUI-022A.2

- Changed: `20261003180000_host_coordination_timing_eligibility.sql` — invalidate ineligible pending hosts; `assign_event_host` requires can-attend; `event_responses` select limited to own row (notes private). App: remove client-side host “suggestion” masquerading as proposal; host assign list filtered by attendance; private attendance note field; `consensusRuleLabel` for required participants.
- Checked: `npm run validate` (241 passed, 2 skipped).
- Deploy: Supabase `20261003180000` applied; app pushed to `main` (Vercel production).

## 2026-10-03 — HUI-022A.1

- Changed: `20261003120000_coordination_lifecycle_correction.sql` — host coordination before confirm, attendance roster, `coordinate_event_host_after_attendance`, first-event `propose_creator_initial_host_for_event`, host-bound seeding fix; UI for initial host on first event; scheduling/notifications/timezone fixes from live QA.
- Checked: `npm run validate` (225 passed, 2 skipped); production `supabase db push` applied `20261003120000`.
- Deploy: app via GitHub → Vercel production; **live Grok QA pending**.
- Commit: b5bb97d

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
- Commit: `b4b0fb7` — PR: https://github.com/jimbook42/Hui/pull/16 — merge `041bc97` on `main` (docs follow-up `6ee3367`); production https://hui-seven-gamma.vercel.app (deployment `dpl_ACsSFenmfXuqtPZZa6bDfxHo5FUD`, READY).
- Manual: Apply migration `20261002200000_contribution_coordination.sql` on linked Supabase (`supabase db push`) before claim/release RPCs work in production. Optional: live contribution E2E with `E2E_TEST_EMAIL` / `E2E_TEST_PASSWORD`.
- Follow-ups: Optional category ordering; multi-user E2E for cross-member edit denial.

## 2026-10-02 — HUI-019

- Changed: Dietary coordination on existing `dietary_entries` / `dietary_entry_shares` — profile **Dietary information** section (add/edit/remove, private/shared status, share/unshare per group); group **Dietary information** and event **Dietary considerations** lists; aggregate reminder on event contributions. Server Actions (`src/app/dietary/actions.ts`), queries (`src/lib/dietary/queries.ts`), domain validation/display, PGlite privacy tests (`src/db/dietary.test.ts`), Playwright journey (`e2e/dietary.spec.ts`, live-auth skipped without E2E credentials). `docs/ARCHITECTURE.md` dietary access flow. No migration.
- Checked: `npm run validate` (181 tests), `npm run test:e2e` (8 passed, 5 live-auth skipped); PR #17 and main CI passed.
- Commit: `a71ae99` — PR: https://github.com/jimbook42/Hui/pull/17 — merge `762fa76` on `main` (docs `1bc63ad`); production https://hui-seven-gamma.vercel.app (deployment `dpl_BnrB2qhnt3NVckyyXexVDG2FLyBb`, READY).
- Manual: Optional live dietary E2E with `E2E_TEST_EMAIL` / `E2E_TEST_PASSWORD`; multi-user smoke that a second member sees shared but not private entries.
- Follow-ups: Per-event dietary snapshots if historical event menus need frozen requirements; richer category UX without medical framing.

## 2026-10-02 — HUI-020

- Changed: Host rotation on `host_assignments` — domain fairness suggestion (`src/domain/hosts`), `assign_event_host` / `respond_to_host_assignment` RPCs (migration `20261002210000_host_coordination.sql`), event Host section and group hosting history UI, server actions, PGlite security tests (`src/db/host-coordination.test.ts`), Playwright `e2e/hosts.spec.ts` (live-auth skipped without credentials). Member-level hosting only; cancelled events excluded from history counts; no scores or auto-assignment.
- Checked: `npm run validate` (193 tests), `npm run test:e2e` (8 passed, 6 live-auth skipped including hosts journey without E2E credentials).
- Production: Apply migration `20261002210000_host_coordination.sql` on linked Supabase before host RPCs work in production.

## 2026-10-02 — HUI-021

- Changed: In-app `member_notifications` (migration `20261002220000_notifications.sql`) with trigger-driven event/consensus/host/contribution messages; reconnect reminders via `sync_reconnect_reminders_for_member()`; profile opt-out `member_reconnect_reminders_enabled`; `/notifications` UI, nav unread badge, mark read; domain + PGlite tests; Playwright auth redirect tests for `/notifications`.
- Checked: `npm run validate` (204 tests), `npm run test:e2e` (10 passed, 6 live-auth skipped).
- Commit: `437bc97` — PR: https://github.com/jimbook42/Hui/pull/18 — merge `a8d7df3` on `main` (includes HUI-020 host rotation); production https://hui-seven-gamma.vercel.app
- Manual: Apply migrations `20261002210000_host_coordination.sql` and `20261002220000_notifications.sql` on linked Supabase before host RPCs and notifications work in production.

## 2026-10-03 — HUI-022A

- Changed: Coordination model correction — migration `20261003000000_coordination_model_correction.sql` (optional hosting, auto-propose host on confirm, accept/swap, member hosting standing, group timezone, contribution seeding and host-bound categories, attendance roster RPC, tighter event/candidate RLS, consensus-required UI). App updates for host UX, named attendance, timezone-aware scheduling display, group settings, member coordination preferences.
- Checked: `npm run validate` (212 tests, build OK).
- Manual: Apply migration on Supabase; run multi-account scenarios A–D from ticket; confirm notifications appear after `db push` (empty list with no migration is expected).
- Follow-ups: Household host rotation; full standing contribution preferences; temporary “can’t host this time”; manual multi-user QA not automated in CI.

## 2026-10-03 — Production Supabase migration deployment

- Changed: Applied pending migrations to linked production project `xmvzzypefpiethefrfka` (`npx supabase db push` after dry-run): `20261002170000_account_deletion_fixes.sql`, `20261002180000_household_member_management.sql`, `20261002200000_contribution_coordination.sql`, `20261002210000_host_coordination.sql` (HUI-020), `20261002220000_notifications.sql` (HUI-021), `20261003000000_coordination_model_correction.sql` (HUI-022A). Verified remote migration history matches local; spot-checked key types/tables/RPCs/triggers on production.
- Checked: `npm run validate` (212 tests, lint, typecheck, build OK).
- Manual: Live multi-user QA for host propose/accept/swap, optional hosting, attendance privacy, host-bound contributions, timezone display, in-app notifications, RLS, and consensus — not completed in this session.

## 2026-10-03 — HUI-022A.1 (in progress)

- Changed: Migration `20261003120000_coordination_lifecycle_correction.sql` — host propose during `proposing` (response trigger), host eligibility (can attend, prefer-not deprioritisation), attendance roster without visibility filter, host RPCs open during coordination, `finalise_event` no longer proposes host at confirm, consensus-ready notification titles by rule. App: host section during proposing, group-visible availability responses, consensus rule label when no required members, group-timezone event edit/display, notification timestamps and Open navigation.
- Checked: pending `npm run validate` and product-owner re-QA before production deploy.
- Blocked: **HUI-022** invitations remain out of scope.
