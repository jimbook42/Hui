# HUI-031 — Recurring cycle engine (design)

**Status:** Design only (no migrations applied).  
**Builds on:** HUI-028 (nominal cadence + planning phases), HUI-025 (standing availability), HUI-026 (propose-time recommendations), existing event/host/contribution RPCs.  
**Pairs with:** HUI-029 (complete event, memories, history surfaces).

---

## 1. End-to-end: how a recurring hui works

A **recurring group** stores a **cadence** (how often the circle *intends* to gather) and a **planning lead** (how many days before the next *nominal* date planning should feel relevant). That cadence does **not** create confirmed future events; it only drives **when the next planning cycle is due** and what **nominal date** the group is planning around.

**Steady state**

1. **Configure once** — On first recurring proposal (or later group settings), the group sets interval (week/month, count), anchor, and optional weekday/time-window preferences (target GDD; week/month only today).
2. **Personal availability once** — Each member may set standing weekly windows per group (HUI-025). These inform hints and propose-time recommendations; per-event responses remain authoritative.
3. **Planning becomes due** — From cadence + last completed (or past confirmed) cycle, the app computes the next **nominal target date** and **planning opens** date (`planning_lead_days` before target, in the **group timezone**). Dashboard and group hero show phase copy and, when due, **Plan next hui**.
4. **One open cycle** — A proposer creates a **proposing** event via `propose_group_event`, usually with `planning_target_date` = that nominal date. The partial unique index prevents two non-cancelled events for the same group + target. Candidate times may be manual or chosen from up to three **HUI-026** suggestions (standing + optional responses, aggregate explanations only).
5. **Respond → consensus → confirm** — Existing scheduling, `event_responses`, consensus summary, and `finalise_event` unchanged. Confirmed time is the real `starts_at`; nominal target stays metadata for the cycle.
6. **Host + contributions + dietary** — Existing host coordination RPCs and contribution request/claim flows; group contribution category templates still seed per event policy (propose-time requests today).
7. **Event happens** — Confirmed event in calendar UX; attendance may still be edited until completed (HUI-026U.3).
8. **Complete** — Organiser/admin marks the event **completed** (HUI-029 delivers UI; engine assumes this transition exists). Completion records `completed_at`, optional `event_memories`, and updates **cycle reference** so the next nominal target advances from this cycle (domain logic already in `resolveCycleReferenceDate`).
9. **Next cycle** — When no blocking proposing/confirmed event exists and planning window is open, phase becomes **ready_to_plan** again; the group proposes the next hui (not auto-created). Optional notifications (email/push) nudge proposers—they do not create events without human action.

**Exceptions (engine responsibility)**

- **Pause recurrence** — Cadence frozen; no new planning due until resumed.
- **Skip one nominal cycle** — Advance reference past a specific nominal date without a completed event.
- **Moved event** — Confirmed `starts_at` may differ from `planning_target_date`; reference policy chooses whether the next cycle follows nominal cadence or actual date (see §6).
- **Cancelled cycle** — Cancelled events do not advance reference; duplicate protection releases the nominal slot for a future proposal.

**Invariant:** At most one “active” planning thread per group in normal operation: one **proposing** or **confirmed** future/present hui tied to the current rhythm, plus history of completed/cancelled cycles as `events` rows.

---

## 2. Data model (sketched migration, not applied)

### 2.1 Principles

- Keep **one event per cycle** (`events` remains the cycle instance).
- Store **durable recurrence config** on the group (already partially on `group_settings` + canonical `recurrence_series`).
- Store **explicit exceptions** (skip, pause) in small side tables for audit and idempotent cron.
- Do **not** duplicate scheduling/host/contribution rows per cycle engine.

### 2.2 New / changed objects

```sql
-- HUI-031 (DRAFT — do not apply until implementation ticket)

-- How we advance the nominal series after irregular outcomes
create type public.cycle_reference_policy as enum (
  'nominal_cadence',      -- always step from planning_target_date / cadence math (default)
  'from_actual_start',    -- after complete, reference = local date of confirmed starts_at
  'gradual_compensation'  -- blend: skip pushes forward without shrinking interval permanently
);

-- Optional explicit recurrence preferences beyond week/month count (GDD direction)
create table public.group_recurrence_preferences (
  group_id uuid primary key references public.groups (id) on delete cascade,
  -- JSON schema versioned by app; example keys: acceptable_weekdays[], time_window_labels[]
  preference_json jsonb not null default '{}'::jsonb,
  reference_policy public.cycle_reference_policy not null default 'nominal_cadence',
  recurrence_paused_at timestamptz,
  paused_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Skipped nominal planning dates (no event, but cycle advances)
create table public.group_planning_cycle_skips (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  nominal_date date not null,
  reason text,
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint planning_skip_unique unique (group_id, nominal_date)
);

-- Materialised “what we think is next” for cron/notifications (optional but idempotent)
create table public.group_planning_cycle_snapshots (
  group_id uuid primary key references public.groups (id) on delete cascade,
  next_nominal_date date,
  planning_opens_on date,
  phase text not null,
  derived_at timestamptz not null default now(),
  derivation_version smallint not null default 1
);

-- Extend events: link cycle outcome to fairness/history (HUI-029 may own memories)
alter table public.events
  add column if not exists cycle_outcome text; -- null | 'completed' | 'skipped' | 'consensus_failed' (app enum later)

-- Extend group_settings (if we avoid a second config table for MVP slice)
-- alter table public.group_settings
--   add column recurrence_paused boolean not null default false;

-- complete_event RPC (sketch)
create or replace function public.complete_event(p_event_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid();
  v_group_id uuid;
  v_status public.event_status;
begin
  if v_actor is null then raise exception 'not authenticated'; end if;
  select e.group_id, e.status into v_group_id, v_status
  from public.events e where e.id = p_event_id;
  if v_status <> 'confirmed' then raise exception 'only confirmed events can be completed'; end if;
  -- permission: creator or group admin/owner (mirror delete_event policy)
  update public.events
  set status = 'completed', completed_at = now(), updated_at = now()
  where id = p_event_id;
  -- snapshot refresh / notification enqueue: implementation ticket
end;
$$;
```

**Existing columns reused (HUI-028):** `group_settings.recurrence_*`, `planning_lead_days`, `canonical_recurrence_series_id`; `events.planning_target_date`; index `events_group_planning_target_active_key`.

**`recurrence_series` (future):** Weekday patterns and monthly “nth weekday” likely need new columns or a `recurrence_rule` child table; HUI-031 MVP can keep series as anchor + mirror cadence on `group_settings` until recurrence UX ticket extends the series row.

### 2.3 RLS considerations

| Object | Read | Write |
| --- | --- | --- |
| `group_recurrence_preferences` | Active group members | Group admins/owners (or `who_may_propose` — product choice) |
| `group_planning_cycle_skips` | Active members | Admins/owners or proposers |
| `group_planning_cycle_snapshots` | Active members | **None** for `authenticated`; refresh via `security definer` RPC/cron only |
| `complete_event` | — | Definer; enforces role + `confirmed` → `completed` |

Standing availability stays **owner-only** (HUI-025). Recommendation RPCs must continue to aggregate server-side; no new peer-visible availability tables.

**RLS pattern:** `group_id` must match `group_memberships` with `status = 'active'`; writes additionally check `is_group_admin_or_owner(group_id)` where policy is admin-only.

---

## 3. Cycle generation

### 3.1 When is the “next cycle” created?

| Mechanism | Creates `events` row? | Purpose |
| --- | --- | --- |
| Member **Plan next hui** / propose flow | **Yes** (proposing) | Primary path today (HUI-028) |
| **`complete_event`** | **No** | Advances reference; may refresh snapshot + notify |
| **Daily cron** (`refresh_group_planning_snapshots`) | **No** | Idempotent phase/snapshot; enqueue “planning opens” notifications |
| **Skip RPC** | **No** | Inserts `group_planning_cycle_skips`; recomputes next nominal |
| **Auto-propose** (deferred GDD) | Yes | Out of HUI-031 MVP unless explicitly scoped |

**Product default:** Never auto-create proposing events without a member action; cron only updates derived state and notifications.

### 3.2 Idempotency

- **Proposal:** `events_group_planning_target_active_key` + `propose_group_event` duplicate check.
- **Skip:** `planning_skip_unique (group_id, nominal_date)`.
- **Snapshot refresh:** upsert on `group_id`; `derivation_version` bumps when domain formula changes.
- **Complete:** single transition `confirmed` → `completed`; reject repeat calls.
- **Cron:** per-group advisory lock or `derived_at` date bucket to avoid notification storms.

### 3.3 Timezone handling

- All **nominal** dates (`planning_target_date`, cadence anchor, skip dates) are **date-only** interpreted in **`group_settings.timezone`** (already used in `buildGroupPlanningCycle` / `todayDateOnlyInTimeZone`).
- **Confirmed** `starts_at` / `ends_at` remain `timestamptz`; recommendation slot generation uses group TZ (`rankTimeRecommendations`, `wallClockToUtcIso`).
- **DST:** Cadence math stays on calendar dates (`addCadenceToDateOnly`); wall-clock slots on transition days use existing datetime helpers—no new DST table.
- **Reference policy `from_actual_start`:** On complete, take local date of `starts_at` in group TZ as the reference for `computeNextTargetDate`.

### 3.4 Domain source of truth

Keep pure functions in `src/domain/recurrence/planning-cycle.ts` (extend for skips, pause, policies). DB snapshot is a cache; app can always recompute from events + settings + skips.

**Skip integration (sketch):** When computing reference, treat each skip’s `nominal_date` as if a completed cycle at that date for advancement purposes, without requiring an event row.

---

## 4. Reuse of existing flows

| Stage | Existing surface | Cycle engine touch |
| --- | --- | --- |
| Propose | `propose_group_event`, staged `/groups/[id]/events/new` | Prefill `planning_target_date`, series reuse, HUI-026 suggestions |
| Respond | `/events/[id]/respond`, `event_responses` | Unchanged; standing hints only |
| Consensus | `event_consensus_summary`, `finalise_event` | Unchanged |
| Host | Host RPCs, swap, standings | After complete, history queries already count `completed` hosts |
| Contributions | Propose-time requests, claims, host-bound sync | Templates per group; per-cycle assignments stay on `event_contributions` |
| Recommendations | `rankTimeRecommendations` + `time-recommendations-data.ts` | Pass `planningTargetDate` from cycle; future: weekday windows from `preference_json` |
| Permissions | `can_propose_in_group`, RLS | Pause/skip/edit cadence gated to admin or proposer per §6 |

No parallel “cycle event” type—`events.status` lifecycle remains `proposing` → `confirmed` → `completed` | `cancelled`.

---

## 5. UX touchpoints

| Intent | Where | Behaviour |
| --- | --- | --- |
| **Create recurrence** | First recurring propose + group settings | Establish cadence on `group_settings`; create/link canonical `recurrence_series`; show “what we heard” summary + **next 2–3 nominal dates** (not confirmed) |
| **Edit recurrence** | Group settings → Recurring | Distinguish **group cadence** vs **this hui only** when a proposing/confirmed event exists; changing cadence recalculates preview; may require admin |
| **Pause** | Group settings | Toggle pause; card shows “Recurrence paused”; no plan CTA; resume restores phase derivation |
| **Skip one** | Group recurring card or manage | Pick upcoming nominal date → confirm skip → copy explains next nominal; no event row |
| **Plan next** | Dashboard + group hero | Existing CTA when `ready_to_plan` and no blocker |
| **Complete** | Event manage (HUI-029) | Marks completed; surfaces memory; group card updates to next due |
| **Failure paths** | Proposing/manage | Cancel cycle; optional mark `cycle_outcome` for consensus failure; does not advance reference unless skip/admin action |

Copy aligns with ROADMAP principles: nominal ≠ confirmed; progressive disclosure for policies (`reference_policy` hidden behind plain language).

---

## 6. Open product questions (for Isaac)

1. **Who may pause, skip, or edit cadence?**  
   *Recommended default:* admins/owners only; any member with propose permission may still start a hui when due.

2. **After complete, advance from nominal target or actual confirmed date?**  
   *Recommended default:* `nominal_cadence` (planning_target_date), with optional group setting `from_actual_start` later.

3. **If a confirmed event is still in the future, can the next planning cycle open?**  
   *Recommended default:* **No** — `findBlockingEvent` keeps `hui_confirmed` until that event is completed or cancelled (matches “one cycle at a time”).

4. **Does skip require a reason, and is it visible to all members?**  
   *Recommended default:* optional reason; visible to all active members (transparency).

5. **Consensus failure / insufficient attendance — auto-skip nominal or leave stuck?**  
   *Recommended default:* leave event proposing or cancelled by organiser; **no** auto-skip; admin may skip nominal explicitly.

6. **Auto-propose a draft hui when planning opens?**  
   *Recommended default:* **No** for MVP; notifications only.

7. **Where do weekday / time-window preferences live for v1 of the engine?**  
   *Recommended default:* `group_recurrence_preferences.preference_json` + UI later; engine v1 ships pause/skip/complete reference only.

8. **Should paused groups suppress reconnect reminders?**  
   *Recommended default:* yes, pause suppresses planning/reconnect nudges until resumed.

---

## 7. Proposed implementation split

### HUI-031-A — Complete event + cycle reference wiring

- `complete_event` RPC, manage UI hook, permissions; completion updates planning phase (no new tables).
- Extend `resolveCycleReferenceDate` tests for confirmed-future vs completed.
- **QA tier 1:** `npm run validate` + Vitest planning-cycle and lifecycle tests.  
- **QA tier 2:** Manual: confirm → complete → group card shows next nominal / plan CTA when due.

### HUI-031-B — Pause, skip, and snapshot refresh

- Migration for `group_planning_cycle_skips`, `group_recurrence_preferences` (or minimal columns on `group_settings`), snapshot upsert RPC, cron entrypoint stub.
- Group settings + recurring card UX for pause/skip; domain recomputation includes skips.
- **QA tier 1:** Vitest skip/pause math; RLS tests for new tables.  
- **QA tier 2:** Manual skip then plan; pause suppresses CTA.  
- **QA tier 3:** Two-member group on linked Supabase—complete/skip/duplicate propose rejection.

### HUI-031-C — Nominal preview + recurrence edit scopes

- Next 2–3 nominal dates component; edit cadence with “this hui / future cycles / whole group” copy (future cycles may defer schema to recurrence UX ticket).
- Wire HUI-026 recommendations to `planning_target_date` when rescheduling within open cycle (optional slice).
- **QA tier 1:** Component/domain tests for preview dates.  
- **QA tier 2:** Mobile layout on group page; first-hui vs established recurrence.

### HUI-031-D — Notifications + cron (optional, can merge with B)

- Enqueue planning-opens / ready-to-plan using snapshot + existing notification kinds; no auto-propose.
- **QA tier 1:** Unit tests for dedupe/idempotency keys.  
- **QA tier 2:** In-app notification visible to proposers.  
- **QA tier 3:** Web Push deep link to propose flow.

*(HUI-029 remains owner for memories UI, ICS, and history presentation; 031-A should expose hooks/events 029 needs.)*

---

## Appendix: current vs target (short)

| Capability | Shipped | HUI-031 target |
| --- | --- | --- |
| Nominal cadence + phases | HUI-028 | + skip/pause + complete hook |
| Duplicate cycle guard | HUI-028 | unchanged |
| Standing availability | HUI-025 | feeds 026 + future windows |
| Time recommendations | HUI-026 propose | optional on-manage |
| Complete → next due | — | 031-A |
| Weekday/monthly patterns | — | later recurrence UX |
| Fairness rotation engine | — | host history only; full rotation later |

**References:** `ROADMAP.md` (recurring principles, loop), `src/domain/recurrence/planning-cycle.ts`, `supabase/migrations/20261005200000_hui_028_recurring_planning_cycle.sql`, `src/domain/events/lifecycle.ts`, `src/domain/scheduling/time-recommendations.ts`.
