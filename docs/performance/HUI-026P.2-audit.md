# HUI-026P.2 — End-to-end interaction latency audit

Engineering investigation record. **Perceived latency** (tap → visible acknowledgement) is the acceptance criterion, not server-only timings.

## Enabling instrumentation

### Browser (production preview or prod)

1. Open any Hui URL with `?hui_perf=1`, **or** in DevTools console: `localStorage.setItem('hui_perf','1')` then reload.
2. Reproduce the interaction.
3. Read the console for lines prefixed `[HUI PERF]`.

Phases logged: `tap`, `handler-start`, `optimistic-ui-visible`, `request-start`, `request-end`, `navigation-start`, `navigation-end`, `usable-ui`, `total-tap-to-visible`, and `long-task` (main thread ≥50ms).

### Server (local / preview server logs)

Set `HUI_DEV_PERF=1` in the environment. Server actions and RSC segments log `[hui-perf] <label>: Nms`.

## Android physical test procedure

Run **≥3 times** per scenario. Record median and worst case.

| Field | Value |
| --- | --- |
| Device | e.g. Pixel / Samsung model |
| Browser | Chrome version |
| Network | Wi‑Fi / 4G / 5G |
| Deployment | URL + git SHA |
| `hui_perf` | enabled via query or localStorage |

### Scenarios

1. **Notification → respond** — tap Open on an unread event notification; note first shell, first useful respond UI, fully usable Yes/Maybe/No.
2. **Attendance Yes** — with `hui_perf=1`, tap Yes; copy console `tap-to-optimistic-ui-visible` and `tap-to-usable-ui` if present.
3. **Attendance Maybe / No** — same.
4. **Suggest another time** — tap link, submit valid time; note tap → form usable → submit → confirmation step.
5. **Display name save** — change name, Save; note pending label and success message vs any refresh hitch.
6. **Dietary save** — edit entry Save; note pending → success → list reconciliation.
7. **Profile navigation** — Dashboard → Profile; note loading shell vs blank wait.

### Subjective scale

- **Instant** — acknowledgement &lt;100ms (target)
- **Noticeable** — 100–300ms
- **Sluggish** — 300ms–1s
- **Broken feel** — &gt;1s before any acknowledgement

## Geography (HUI-026P.2)

| Layer | Finding |
| --- | --- |
| Vercel production build | **Washington, D.C. (`iad1`)** — observed on CLI deploy logs (2026-10-04). |
| Supabase API host | `xmvzzypefpiethefrfka.supabase.co` (Cloudflare front; **project region must be confirmed in Supabase dashboard** — typically `ap-southeast-2` for AU/NZ projects). |
| Impact | If Supabase DB/Auth is in Sydney and Functions run in `iad1`, each server round trip adds ~150–250ms+ RTT per hop. Multiple sequential `getUser` + queries multiply this. **Do not change regions in this ticket** — document and size a follow-up. |

## Code-traced bottlenecks (pre-fix)

| Interaction | Dominant cause (traced) | Evidence |
| --- | --- | --- |
| Attendance Yes/Maybe/No | **Next/RSC + network** — step advance and selected state waited for `setAvailabilityResponseAction` (includes `getEventDetail` + settings + upsert) before `pushStep`; then `router.refresh()` refetched respond page. | `event-participant-respond-flow.tsx` `saveAttendance` |
| Notification Open | **Next/RSC** — `await markNotificationRead` before `router.push`. | `open-notification-button.tsx` |
| Display name save | **Mixed** — pending via `useActionState` is immediate; full profile RSC refetch removed in P.1; dietary/household sections still heavy on any refresh. | `auth-form.tsx`, profile page |
| Profile navigation | **Next/RSC + network** — no route `loading.tsx` (added in P.2); large profile RSC payload. | profile route |
| Attendance server action | **Supabase/DB + app waterfall** — `getEventDetail` before upsert. | `scheduling-actions.ts` |

## Fixes applied in HUI-026P.2

- **Attendance** — immediate selected state + step transition on tap; persistence and `router.refresh()` deferred; rollback on error.
- **Notification Open** — `router.push` first; mark-read in background.
- **Client perf** — `client-interaction-perf.ts` + bootstrap; profile `loading.tsx`.
- **Server** — finer `HUI_DEV_PERF` spans on `setAvailabilityResponseAction`.

## Fixes deliberately not made

- Removing `getEventDetail` from attendance action (needs security/validation design; separate ticket).
- Optimistic dietary list without server props (needs client reconciliation pattern).
- Region migration / edge placement.
- Permanent analytics pipeline.

## Desktop sample (Cursor agent, Chrome, production alias, 2026-10-04)

Not a substitute for Android. Unauthenticated smoke only:

| Check | Result |
| --- | --- |
| `GET /profile` (no session) | 307 → sign-in (~200ms TTFB from agent network) |
| Instrumentation bundle | Present when `hui_perf=1` on client routes |

**Android timings:** *requires manual runs using the procedure above.*
