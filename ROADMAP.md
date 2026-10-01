# Hui roadmap

**Phase:** 0 — Foundation  
**Milestone:** Project scaffold and workflow  
**Current ticket:** HUI-007 — Groups, memberships and administration  
**Overall progress:** Phase 0 foundation complete; Phase 1 starting

## Status at a glance

| Phase | Status |
| --- | --- |
| 0 — Foundation | [x] Complete |
| 1 — Identity, groups and membership | [~] In progress |
| 2 — Group settings and permissions | [ ] Not started |
| 3 — Event domain and proposal flow | [ ] Not started |
| 4 — Scheduling and consensus | [ ] Not started |
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

- [x] Auth flows (Supabase Auth) — HUI-006
- [x] Profile/person model — HUI-006
- [ ] HUI-007 — Group creation, invites, membership roles (admin vs member)
- [ ] Group creation and invites
- [ ] Membership roles (admin vs member)

## Phase 2 — Group settings and permissions

- [ ] Group-level configuration (maybe responses, vetoes, proposal rules)
- [ ] Admin member management
- [ ] RLS policies for group data (initial tenancy policies landed in HUI-005; extend them with each feature)

## Phase 3 — Event domain and proposal flow

- [ ] Event and proposal domain model
- [ ] One-off events (no separate architecture)
- [ ] Proposal permissions and deadlines

## Phase 4 — Scheduling and consensus

- [ ] Candidate dates/times and responses
- [ ] Minimum attendees and consensus rules
- [ ] Finalisation when requirements met

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
