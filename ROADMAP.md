# Hui roadmap

**Phase:** 4 — Scheduling and consensus  
**Milestone:** Consensus and finalisation  
**Current ticket:** HUI-010 complete; next ticket not started  
**Overall progress:** HUI-010 complete

## Status at a glance

| Phase | Status |
| --- | --- |
| 0 — Foundation | [x] Complete |
| 1 — Identity, groups and membership | [x] Complete |
| 2 — Group settings and permissions | [~] Partial (settings UI in HUI-007; event permissions in later tickets) |
| 3 — Event domain and proposal flow | [~] Foundation (HUI-008) |
| 4 — Scheduling and consensus | [x] HUI-009 responses and HUI-010 consensus/finalisation |
| 5 — Host rotation | [ ] Not started |
| 6 — Contributions and dietary information | [ ] Not started |
| 7 — Notifications and reminders | [ ] Not started |
| 8 — Calendar export | [ ] Not started |
| 9 — Memories/history | [ ] Not started |
| 10 — Hardening, privacy and production readiness | [ ] Not started |

## Phase 0 — Foundation

- [x] HUI-001 — Next.js/TypeScript/Tailwind scaffold, tests tooling, workflow docs
- [x] HUI-002 — Supabase project, env wiring, client bootstrap
- [x] HUI-003 — PWA service worker and installability (beyond manifest)
- [x] HUI-004 — CI and development quality gates
- [x] HUI-005 — Supabase database schema and migrations
- [x] HUI-006 — Authentication and user profiles

## Phase 1 — Identity, groups and membership

- [x] HUI-006 — Auth flows and profile/person model
- [x] HUI-007 — Group creation, membership roles, administration (settings view/edit; add by user ID)

## Phase 2 — Group settings and permissions

- [x] Event proposal permission enforcement in application layer (HUI-008; RLS from HUI-005)
- [ ] RLS policies extended with each feature as needed

## Phase 3 — Event domain and proposal flow

- [x] HUI-008 — Event and proposal foundation (create/list/detail/edit/cancel; recurrence series anchor)
- [x] One-off events (same `events` table; no separate architecture)
- [x] Candidate dates and private availability responses (HUI-009)
- [ ] Proposal deadlines (later ticket)

## Phase 4 — Scheduling and consensus

- [x] Candidate dates/times and responses (HUI-009)
- [x] Minimum attendees and consensus rules (HUI-010)
- [x] Finalisation when requirements met (HUI-010)

## Phase 5 — Host rotation

- [ ] Host assignment and rotation rules
- [ ] Host veto (when enabled)

## Phase 6 — Contributions and dietary information

- [ ] Contribution coordination and fairness
- [ ] Dietary preferences per person/event

## Phase 7 — Notifications and reminders

- [ ] Event and proposal notifications
- [ ] Optional reconnect reminders after inactivity

## Phase 8 — Calendar export

- [ ] Export confirmed events only (no import/sync in MVP)

## Phase 9 — Memories/history

- [ ] Event memories and group history views

## Phase 10 — Hardening, privacy and production readiness

- [ ] Security review, RLS audit, performance
- [ ] Production deployment and monitoring

## Known blockers

- [!] None

## Deferred decisions

- Hosting provider beyond initial Vercel trials (app must stay portable)
- shadcn/ui adoption timing (add when UI work begins)
- Push notification channel for PWA reminders
- Email-based group invitations (HUI-007 adds members by existing user ID only)
