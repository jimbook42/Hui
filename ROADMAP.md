# Hui roadmap

**Phase:** Core MVP — recurring planning, invitations, and delivery  
**Milestone:** GDD definition of done (not yet reached)  
**Current ticket:** **HUI-022A.3** — deployed; **pending live multi-user Grok QA** (Family Dinner host accept/swap + Main while proposing)
**Last completed ticket:** **HUI-022A.2** — host timing/eligibility (`20261003180000` + app; deployed)
**Overall progress:** Foundation through HUI-021 shipped significant event, scheduling, host, contribution, dietary, and in-app notification **foundations**. Core GDD loop (invitations, recurring planning cycles, recurrence UX, persistent availability, scheduling recommendations, full notifications, calendar/memories, completed-event → next cycle) remains **open**.

**North star:** HuI proposes, coordinates and remembers. **The group decides.**

**Next implementation ticket:** **HUI-022** — Invitations and frictionless joining

---

## Product philosophy

**Hui should absorb complexity, not expose it.**

The system may use sophisticated recurrence logic, availability, fairness history, household rules, host eligibility, and contribution rules. Users should see simple questions and useful recommendations.

| Good | Bad |
| --- | --- |
| “How often do you usually get together?” → “Every 6 weeks” | Frequency: 6, Unit: WEEK, BYDAY: SA,SU |
| “Which days usually work?” → “Saturday or Sunday” | RRULE configuration screens |
| “Alex is suggested as host because they haven’t hosted recently and are available.” | Fairness score = 0.73 |

Hui explains enough to build trust without exposing implementation mechanics. Hui recommends; the group decides.

---

## Locked product decisions

These are settled product direction, not backlog debates.

1. **Core product before commercialization** — Build the GDD definition of done before monetisation.
2. **Recurring groups are core** — Recurring gatherings are central, not an optional enhancement.
3. **Recurrence schedules planning, not confirmed events** — A recurrence rule tells Hui when to **start planning** the next gathering. It does **not** auto-create a chain of confirmed future events. Normally only **one** active/next planning cycle at a time.
4. **Previous event → next cycle** — Typical flow: complete event → memory/history → update host/contribution state → next cycle becomes due → open planning → … Nominal future recurrence dates are **expectations**, not locked events.
5. **User-friendly language** — No RRULE/BYDAY/anchor jargon in normal UX; progressive disclosure; natural phrasing (“Every 6 weeks, usually Saturday or Sunday”).
6. **Set preferences once** — Persistent group recurrence preferences and **persistent personal availability**; event-specific overrides still allowed.
7. **Hui does the scheduling work** — Combine recurrence, weekdays, time windows, persistent + event availability, Works / Can make work / Can’t attend, minimum attendance, consensus, and conflicts; surface **strongest candidate options** with explainable logic (no opaque competitive scores).
8. **Invitations are required for GDD** — Add-by-user-ID (HUI-007) is insufficient; shareable links, unauthenticated invite, signup continuation, explicit accept.
9. **Web Push where supported** — Required for MVP notification delivery (with email and in-app), not deferred.
10. **Calendar MVP** — Confirmed events + outbound ICS (+ optional protected feed); **no** import/sync (Google/Microsoft/Apple).
11. **Host fairness ≠ contribution fairness** — Separate dimensions; no public leaderboards.
12. **Standing rules vs event assignments** — Changing one event must not silently rewrite standing host/contribution preferences.
13. **Casual vs recurring** — Casual groups: no fixed cadence, inactivity/reconnect, lightweight “Plan something”. Recurring: cadence-driven planning cycles. One-offs: no recurring group required.

---

## Recurring planning UX principles

- User-friendly language and progressive disclosure
- Minimal setup and sensible defaults
- Set recurring group preferences once; set personal availability once
- Do not repeatedly ask the same questions each cycle
- Recurrence schedules **planning**, not locking future confirmed events
- Normally only one next planning cycle is active
- The previous event normally **completes** before the next cycle opens
- Hui compares availability and surfaces strongest options
- Private availability stays private; members see derived coordination info only
- **Works / Can make work / Can’t attend** remain distinct (not reduced to yes/no)
- Show users what Hui thinks their recurrence means
- Show next **2–3 nominal** dates; label them as **not** confirmed events
- Confirmation requires the group’s configured rules
- Changes to future recurrence are explicit (this event vs future cycles vs whole group config)
- Technical recurrence concepts stay under the UX
- Mobile-first; **the group remains in control**

---

## Recurring planning requirements

**Conceptual loop:**

```
GROUP RECURRENCE
  → DETERMINE WHEN PLANNING IS DUE
  → OPEN NEXT PLANNING CYCLE
  → COMBINE GROUP + PERSONAL AVAILABILITY
  → FIND STRONGEST OPTIONS
  → MEMBERS RESPOND
  → CONSENSUS
  → CONFIRM
  → HOST RECOMMENDATION
  → HOST ACCEPTANCE / SWAP
  → CONTRIBUTIONS + DIETARY
  → EVENT
  → COMPLETE
  → MEMORY / HISTORY
  → UPDATE FAIRNESS / ROTATION STATE
  → NEXT CYCLE
```

**NOMINAL RECURRENCE DATE ≠ CONFIRMED EVENT.**

### Recurrence model (target behaviour)

| Area | Requirement |
| --- | --- |
| **Weeks** | Every week, every 2 weeks, every N weeks (e.g. every 6 weeks on Saturday or Sunday) |
| **Months** | Every month, every 2 months, every N months — **not** “monthly = four weeks” |
| **Monthly patterns** | Same date; first/second/third/fourth/last Saturday or Sunday; etc. |
| **Multiple weekdays** | e.g. “Saturday or Sunday” — interval, acceptable weekdays, time windows, and **actual** event datetime are distinct |
| **Time windows** | Natural preferences (Saturday afternoon, weekend, etc.) without forcing precision at setup |
| **Nominal preview** | Next 2–3 nominal dates, clearly not confirmed |
| **Policies** | Keep anchor, roll from actual, compensate gradually, choose each time, skip cycle — **under the hood**; natural consequence copy in UX |
| **Exceptions** | Moved event, skipped cycle, cancelled cycle, insufficient attendance, consensus failure, recurrence change, host unavailable — scope: this cycle vs future vs whole configuration |

**Examples (group cadence):**

- Every 2 weeks, usually Saturday
- Every 6 weeks, Saturday or Sunday
- Every month on the second Saturday
- Every 2 months on the last Sunday

**Examples (personal availability — persistent + per-event override):**

- Can’t do Saturdays 11am–2pm
- Usually free Sunday afternoons
- Prefer Saturday evenings
- Can make Saturday work if necessary

Hui combines group recurrence, preferred days/windows, persistent preferences, and event-specific responses to propose suitable candidate times.

### Host rotation (target — beyond HUI-020 foundation)

Per cycle: eligible hosts (member/household rotation units), history, recent hosting, standing preferences/exclusions, temporary unavailability, deferred turns, prior swaps → recommend host → accept/decline → swap/volunteer → record final host → feed completed event back into rotation.

Standing rules: never hosts, cannot host currently, prefers not to, happy to host, no consecutive hosts, deferred turn, admin override. **Never hosts** must not accrue implied hosting debt. Swaps must preserve rotation fairness state (proposed, declined, swap accepted, who actually hosted).

### Contribution coordination (target — beyond HUI-018 foundation)

GDD categories: Starter, Main, Side, Dessert, Drinks, Supplies, Custom. Standing preferences (“Alex usually brings drinks”) vs per-event claim/assign/release/reassign/substitution/gap identification. Household-level and individual-level rules where configured.

### Personal availability (target)

Persistent recurring constraints/preferences with privacy; per-event override; Works / Can make work / Can’t attend.

---

## Status at a glance

| Area | Status | Notes |
| --- | --- | --- |
| 0 — Foundation | [x] Complete | HUI-001–006, 011–016, CI/PWA/schema |
| 1 — Identity, groups, membership | [~] Partial | Auth, profiles, households, roles; **no** invitation/join flow |
| 2 — Group settings | [~] Partial | Settings UI (HUI-007); some fields unused in app (e.g. proposal deadline) |
| 3 — Event domain | [~] Foundation | HUI-008: CRUD, cancel; recurrence **series anchor only** |
| 4 — Scheduling & consensus | [~] Partial | HUI-009/010/017: manual candidates, consensus, finalise; **no** recommendation engine or persistent availability |
| 5 — Host coordination | [~] Partial | HUI-020 foundation + **HUI-022A**: auto-propose on confirm, accept/swap, optional hosting, no auto-accept, consecutive-host setting, member “I don’t host”; **not** household rotation or full fairness engine |
| 6 — Contributions & dietary | [~] Partial | HUI-018/019 + **HUI-022A**: seed categories on confirm, host-bound categories, default assignee column; **not** full standing-preference editor or admin reassignment flows |
| 7 — Notifications | [~] Foundation | HUI-021 + **HUI-022A** trigger copy fixes; **not** Web Push/email/outbox/deep links |
| 8 — Recurring planning & invitations | [ ] Not started | HUI-022–026 (and related) |
| 9 — Delivery, calendar, memories | [ ] Not started | HUI-027–029 |
| 10 — Production MVP | [ ] Not started | HUI-030 |

---

## Completed implementation tickets (accurate scope)

Do not treat these as completing the larger GDD capabilities listed in later sections.

### Phase 0 — Foundation

- [x] **HUI-001** — Next.js/TypeScript/Tailwind scaffold, tests tooling, workflow docs
- [x] **HUI-002** — Supabase project, env wiring, client bootstrap
- [x] **HUI-003** — PWA service worker and installability (network-only SW; **not** Web Push)
- [x] **HUI-004** — CI and development quality gates
- [x] **HUI-005** — Database schema and migrations (groups, events, candidates, responses, hosts, contributions, dietary, **event_memories** table, recurrence_series, RLS foundation)
- [x] **HUI-006** — Authentication and user profiles
- [x] **HUI-011** — Social auth provider registry and UI groundwork
- [x] **HUI-012** — Google OAuth (Hui-side; Supabase provider must be enabled; production sign-in retest still recommended)
- [x] **HUI-012A** — OAuth initial display name from provider metadata
- [x] **HUI-012B** — Account deletion and re-registration
- [x] **HUI-013** — Microsoft/Azure OAuth (Hui-side; live sign-in retest still required)
- [x] **HUI-013A** — Azure `email` scope on OAuth
- [x] **HUI-014** — Facebook/Meta OAuth (Hui-side; full login retest still recommended)
- [x] **HUI-015** — Profile, identity and account settings foundation
- [x] **HUI-016** — Household and member structure (per-group households; member-managed membership)

### Phase 1 — Identity, groups and membership

- [x] **HUI-007** — Group creation, roles, administration (settings view/edit; **add member by user ID only** — not GDD invitations)
- [x] **HUI-006**, **HUI-015**, **HUI-016** — (see Phase 0)

### Phase 2 — Group settings and permissions

- [x] Event proposal permission enforcement in application layer (HUI-008; RLS from HUI-005)
- [ ] RLS and policies extended/reviewed for each remaining feature (ongoing)
- [ ] UI for `group_memberships.consensus_required` when using required-participants rule

### Phase 3 — Event domain and proposal flow

- [x] **HUI-008** — Event foundation: create/list/detail/edit/cancel; optional link to `recurrence_series` (**anchor only** — interval unit/count/start date; **no** planning cycles, weekday patterns, time windows, or nominal-date engine)
- [x] One-off events (same `events` table)
- [x] Candidate dates and private availability responses (**HUI-009**)
- [ ] Proposal **deadlines** — `proposal_deadline_hours` exists on `group_settings` but is **not** stored or enforced per event
- [ ] Event **completion** flow and memories UI — `completed` status and `event_memories` exist in schema; **no** app workflow yet
- [ ] **Reopen**, material change, and full audit narrative per GDD (partial lifecycle only today)

### Phase 4 — Scheduling and consensus

- [x] **HUI-009** — Candidate times; per-user responses with privacy; DB `yes` / `no` / `maybe` mapped in UI largely as available / maybe / unavailable
- [x] **HUI-010** — Minimum attendees, consensus rules, `finalise_event` when requirements met
- [x] **HUI-017** — Event page scheduling UX (aggregates, finalise control, household-grouped roster)
- [ ] **Hui finds strongest options** — members/admins propose candidates manually today; **no** combined constraint solver or ranked recommendations
- [ ] Product copy alignment: **Works / Can make work / Can’t attend** (GDD) vs current availability labels
- [ ] Response reminders tied to deadlines (blocked on deadline feature)
- [ ] Automatic confirmation where configured (beyond manual finalise)

### Phase 5 — Host coordination (foundation only)

- [x] **HUI-020** — **Foundation:** host assignment model, history, member-level counts (`20261002210000_host_coordination.sql`)
- [x] **HUI-022A** — **Corrections (deployed):** hosting optional; host propose/accept/swap; member hosting standing; attendance roster RPC; group timezone; contribution seeding; RLS (`20261003000000_coordination_model_correction.sql`)
- [~] **HUI-022A.1** — deployed; live Grok QA found host-timing, eligibility, consensus label, and private-note gaps (see HUI-022A.2).
- [x] **HUI-022A.2** — deployed (`20261003180000_host_coordination_timing_eligibility.sql` + app): no premature host suggestion UI; pending host invalidated on can't-come; accept/swap during proposing; private attendance note + RLS; consensus label source of truth. Live QA found host-bound Main not following accepted host while proposing → **HUI-022A.3**.
- [~] **HUI-022A.3** — implementation complete and deployed (`20261003220000_host_bound_contribution_sync_on_accept.sql` + PGlite tests): `sync_host_bound_contributions` seeds missing rows during `proposing`/`confirmed` then assigns host-following categories to accepted host only. **Pending live Grok QA** (not HUI-022).
- [ ] **Still open:** recurring-cycle integration; household rotation units as hosts; temporary “can’t host this time”; deferred turns; volunteer flow; full standing preference matrix; contribution preference editor beyond defaults
- [ ] Fairness uses count ties only — sufficient as a **start**, not full GDD fairness narrative (recent hosting, exclusions, swaps)

### Phase 6 — Contributions and dietary information

- [x] **HUI-018** — **Foundation:** category admin; member **claim** / edit own / **release** via RPCs; transparent **history counts** (not scores); migration `20261002200000_contribution_coordination.sql`
- [ ] Standing contribution preferences (“usually brings drinks”)
- [ ] Admin assignment, reassignment, substitution, gap surfacing beyond open claims
- [ ] Host ↔ main (or other) standing dinner structure
- [x] **HUI-019** — Profile dietary entries, group/event shared views, privacy via `dietary_entry_shares` (no new migration)

### Phase 7 — Notifications (foundation only)

- [x] **HUI-021** — **Foundation:** `member_notifications`, read state, trigger-driven in-app messages for some domain events, reconnect reminders (`sync_reconnect_reminders_for_member`), profile opt-out; migration `20261002220000_notifications.sql`
- [ ] **Not in HUI-021:** Web Push subscriptions and delivery; email; outbox → worker → channel architecture; full actionable **deep links** for all GDD notification types; invitation notifications

### Phase 8 — Calendar export

- [ ] Outbound ICS for confirmed events; optional protected ICS feed
- [ ] Explicitly **out of MVP:** calendar import/sync

### Phase 9 — Memories / history

- [ ] Completed-event workflow (attendance, final host, contributions, notes)
- [ ] Group history views
- [ ] **Completed event → update rotation/contribution state → next recurrence planning due → open cycle**

### Phase 10 — Hardening and production readiness

- [ ] Security review, RLS audit, performance, monitoring
- [ ] Full E2E validation of core loop (see below)
- [x] Google, Microsoft, Facebook OAuth on Hui side (Apple backlog — not an MVP blocker)
- [ ] Apple Sign in with Apple (requires Apple Developer Program)

---

## Remaining core MVP tickets (HUI-022+)

Capabilities may span tickets; nothing below is optional for GDD MVP.

### HUI-022 — Invitations and frictionless joining

- Invitation records and lifecycle (invited, accepted, declined, expired/revoked)
- Shareable / deep invitation link
- Unauthenticated invite experience; which group invited them
- New user signup → return to invitation → **explicit accept** → membership + role
- Existing user acceptance path
- RLS/security; invitation notifications (when delivery stack exists)
- Replace add-by-user-ID as the primary onboarding path

### HUI-023 — Recurring planning / cycle engine

- **Planning due** from group recurrence (not auto-confirmed event chains)
- Open/close planning cycle; normally one active next cycle
- Tie to group recurrence configuration (consumes HUI-024 model)
- Skipped cycle, moved event, insufficient attendance, consensus failure hooks
- **Complete event** → memory/history triggers → fairness state → next cycle due
- Integrate host recommendation timing and contribution phase into cycle states

### HUI-024 — Recurrence configuration and user-friendly recurrence UX

- Weeks/months/N intervals; monthly weekday patterns; multiple acceptable weekdays; time windows
- Nominal **2–3 date preview** (labeled not confirmed)
- Exception UX: this event vs future cycles vs group config
- Hidden recurrence policies with natural-language consequences
- Migrate/extend beyond current `recurrence_series` (week/month count + `starts_on` only)

### HUI-025 — Persistent personal availability / preferences

- Store recurring constraints and preferences per member (privacy-preserving)
- Per-event overrides
- Works / Can make work / Can’t attend (align product copy and rules with maybe-enabled groups)
- Feed HUI-026; do not re-prompt every cycle

### HUI-026 — Scheduling / recommendation engine

- Combine recurrence, weekdays, windows, persistent + event availability, consensus thresholds
- Surface strongest candidate options with **explainable** summaries (e.g. “7/7 can attend”)
- Document recommendation algorithm; no opaque leaderboard scores
- Optional: auto-propose candidates for group review (group still confirms)

**Host rotation (full GDD)** — implement within HUI-023/026 or a focused slice:

- Eligibility, household rotation units, standing exclusions, deferred turns, swaps, volunteer
- Explainable recommendation; integrate with cycle and completed-event history

**Contribution coordination (full GDD)** — extend HUI-018 within HUI-023/029:

- Standing rules vs event assignments; assign/reassign/gaps; household-level rules

### HUI-027 — Web Push + notification delivery architecture

- Committed DB state → **outbox** → **worker** → delivery
- Web Push where supported (MVP requirement)
- Deep links to actions
- Extend beyond trigger-only in-app inserts

### HUI-028 — Email delivery + actionable notification flows

- Email channel for GDD notification types
- Deep links; invitation and planning/reminder flows
- Coordination with HUI-027 outbox

### HUI-029 — Calendar ICS + memories/history + next-cycle integration

- Outbound ICS (and optional protected feed) for **confirmed** events only
- Event completion UI/workflow; `event_memories` and group history
- Attendance, final host, contributions on record
- Wire **complete → history → host/contribution state → next planning cycle**

### HUI-030 — Production hardening + MVP validation

- RLS audit, privacy review, concurrency/idempotency, time zones/DST
- Accessibility and mobile/PWA UX pass
- Production monitoring; migration parity on linked Supabase (**parity achieved 2026-10-03** — re-check after future migrations)
- Execute **full E2E core loop** test plan; OAuth production smoke where applicable

---

## MVP definition of done (GDD checklist)

| Capability | Status |
| --- | --- |
| Authentication (email + configured OAuth) | [x] Mostly (Apple optional) |
| Groups, roles, households | [x] Foundation |
| Invitations + frictionless invite acceptance + signup continuation | [ ] HUI-022 |
| Recurring groups + casual groups + one-off events | [~] Settings/one-off/recurring **anchor** only |
| Recurrence: weeks, months, N intervals, weekday patterns, multi-weekday, time windows, nominal preview | [ ] HUI-024 |
| Recurrence schedules **planning**, not confirmed future chain | [ ] HUI-023 |
| Persistent availability + event overrides + private availability | [ ] HUI-025 |
| Works / Can make work / Can’t attend | [~] maybe/yes/no mechanics; copy/rules incomplete |
| Candidate times + consensus + minimum attendance | [x] HUI-009/010/017 |
| Deadlines + response reminders | [ ] |
| Admin override, host veto, reopen, material changes | [~] Partial (veto, finalise; not full GDD) |
| Hui finds strongest options (explainable) | [ ] HUI-026 |
| Host eligibility, never hosts, recommendation, accept/decline, swaps, deferred turns | [~] HUI-020 foundation only |
| Contribution categories, standing rules, event assign/claim/reassign, history | [~] HUI-018 foundation only |
| Dietary information (privacy tiers) | [x] HUI-019 |
| Event confirmation | [x] finalise_event |
| Outbound ICS | [ ] HUI-029 |
| Web Push + email + in-app actionable notifications | [~] in-app only HUI-021 |
| Reminders (planning, deadline, event) | [ ] |
| Event completion + memories/history | [ ] HUI-029 |
| Host/contribution history update + **next recurring cycle** | [ ] HUI-023/029 |
| RLS/security, privacy, TZ/DST | [~] foundation; audit in HUI-030 |
| PWA/mobile UX, a11y, production monitoring | [~] partial |
| Full E2E core loop validation | [ ] HUI-030 |

---

## Full E2E core loop (acceptance journey)

Validate end-to-end:

1. Create group → **invite members** → new user follows invitation → join  
2. Configure household → configure **recurrence** (natural language UX)  
3. Members set **persistent availability**  
4. **Next planning cycle opens** → propose → respond  
5. **Hui finds strongest options** → consensus → confirm  
6. **Host recommendation** → accept/decline/swap  
7. **Contributions** + dietary coordination → event  
8. **Complete event** → memory/history → host/contribution history updated → **next planning cycle**

Also exercise: minimum attendance, deadline, admin override, host veto, never-host rule, host swap, contribution reassignment, casual inactivity, skipped cycle, moved event, recurrence change, household behaviour, non-response.

---

## Known blockers and prerequisites

| Item | Detail |
| --- | --- |
| Supabase migrations in production | **Applied 2026-10-03** on linked project `xmvzzypefpiethefrfka` via `supabase db push` (includes `20261002170000`–`20261003000000` through HUI-022A). **Live multi-user product QA** for coordination/notifications still required before treating flows as done. |
| Invitation + delivery | HUI-022 depends on auth/session; invitation notifications fully depend on HUI-027/028 |
| Recurring engine | HUI-023 depends on extended recurrence model (HUI-024) and benefits from HUI-025/026 |
| Event completion | Schema supports `completed` and `event_memories`; app workflow required before next-cycle loop is real |
| OAuth production | Google/Microsoft/Facebook enabled in Supabase dashboard; live sign-in retest recommended |

No other **hard** blockers identified in-repo; remaining work is substantial product implementation, not a single external dependency.

---

## Deferred decisions (genuinely unresolved)

- Hosting provider beyond initial Vercel trials (keep app portable)
- shadcn/ui adoption timing
- Apple Sign in with Apple activation timing (requires paid Apple Developer Program — **not** MVP blocker)
- Identity linking rules for multiple OAuth providers per person (document in DECISIONS when implemented)
- Exact internal fairness tie-breakers beyond explainable history (must stay non-competitive)

**Removed / decided:**

- ~~Push notification channel for PWA reminders~~ → **Web Push where supported** (MVP)
- ~~Email-based group invitations as optional~~ → **Required** invitation/join product (HUI-022) plus email **delivery** (HUI-028)

---

## Repository vs prior roadmap (corrections)

| Prior claim | Actual state |
| --- | --- |
| Phase 5 Host rotation [x] | HUI-020 is **host assignment + count-based suggestion + veto** only — not full recurring host rotation |
| Phase 7 Notifications [x] | HUI-021 is **in-app foundation** only — not Web Push, email, or outbox/worker |
| HUI-008 recurrence | **Series anchor** (title, week/month interval, starts_on) — **not** recurring planning engine |
| Known blockers: None | **Production DB is migration-current** (Oct 2026 push); **large GDD gaps** (invitations, cycles, recommendations, delivery, memories) and **live coordination QA** remain |
| Add by user ID | Still the only membership path; UI copy acknowledges invitations are future work |

---

## Core loop reference

```
GROUP → TIME TO GET TOGETHER → PROPOSE → RESPOND → HUI FINDS STRONGEST OPTIONS
  → GROUP AGREES → HOST + CONTRIBUTIONS → EVENT → REMEMBER → GET TOGETHER AGAIN
```

Recurring groups add: **nominal cadence → planning due → one cycle at a time → confirm one event → complete → next due.**
