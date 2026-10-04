# HUI-026P.3 — Navigation & data-loading performance

## Measured before (Android on `fc5df7b`, from ticket)

| Journey | Acknowledgement | First useful UI | Fully settled |
| --- | --- | --- | --- |
| Notification → event/respond | Improved (P.2) | ~5s | ~5s |
| Groups | Improved | ~4s | ~4s |

Cursor did not re-run Android timings for P.3; use `?hui_perf=1` after deploy.

## Diagnosis (code audit)

### Notification → `/events/[id]/respond`

**Critical path before P.3:**

```text
auth
  → getEventDetail (sequential)
  → Promise.all [
       getGroupDetail (full member roster),
       scheduling,
       contributions,
       categories,
       getEventHostContext (assignments + group host history),
     ]
  → single RSC payload → client flow
```

Primary attendance UI only needs: event identity, scheduling candidates, group **settings** (not members), accepted host **name** (not history).

### Groups `/groups`

- Page blocked on `listGroupsForUser` before any markup.
- `AppShell` blocked on `NotificationsNavLink` (auth + unread count) before children.

### Geography

- Vercel production builds: **`iad1`** (CLI deploy logs).
- Supabase project host: `xmvzzypefpiethefrfka.supabase.co` — **dashboard region not confirmed programmatically**.
- Cross-region RTT remains a likely contributor to multi-second server phases.

## Changes (P.3)

| Area | Change |
| --- | --- |
| Respond route | `loadRespondPrimary` — detail + parallel scheduling/settings/light host name; contributions deferred |
| Respond route | `secondaryDataPromise` loaded client-side for bring step only |
| Respond `loading.tsx` | Full `AppShell` + structured skeleton |
| Groups | Static shell + `Suspense` around `GroupsList`; route `loading.tsx` |
| App shell | `Suspense` around notification badge (nav label renders immediately) |
| Perf marks | Navigation phases: `route-shell-visible`, `first-useful-ui`, `secondary-content-visible`, `fully-settled` |

## Dependency graph after

### Respond (primary RSC)

```text
auth (cached)
  → getEventDetail
  → parallel [ scheduling, group_settings, accepted_host_name ]
  → primary UI
```

### Respond (secondary, non-blocking)

```text
parallel [ listEventContributions, listContributionCategories ]
  → bring step (client)
```

## Deferred

- Slim `getEventDetail` for respond-only fields
- Edge/region alignment (infrastructure ticket)
- Event detail page further streaming (partially done in P)
- Profile page section streaming

## Android re-test checklist

Same as P.2, plus note `route-shell-visible` vs `first-useful-ui` in console.
