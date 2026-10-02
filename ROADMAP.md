# Hui roadmap

**Phase:** 4 — Scheduling and consensus  
**Milestone:** Social auth  
**Current ticket:** HUI-012B — account deletion (implemented; preview env + manual validation pending)  
**Overall progress:** HUI-012B code complete; merge blocked on preview deletion test

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
- [x] HUI-011 — Social auth provider config and auth UI groundwork (email/password only in UI; OAuth backlog)
- [x] HUI-012 — Google OAuth integration (Hui-side; Google provider enabled in Supabase; production sign-in test still required)
- [x] HUI-012A — OAuth initial profile display name from provider metadata (trigger + app precedence; existing names preserved)
- [~] HUI-012B — Account deletion and re-registration (two-step profile UI, `delete_my_account_data`, server `SUPABASE_SECRET_KEY` Auth admin delete, unit/PGlite tests; **preview:** set `SUPABASE_SECRET_KEY` on Vercel Preview, then run full destructive flow before merge)

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
- [x] Google OAuth integration — Hui-side (HUI-012); Google provider enabled in Supabase; production sign-in test still required
- [ ] Microsoft / Azure OAuth integration
- [ ] Meta / Facebook OAuth integration
- [ ] Apple Sign in with Apple integration (requires Apple Developer Program membership)

## Known blockers

- [!] **HUI-012B preview:** Vercel project `jimbook/hui` has no `SUPABASE_SECRET_KEY` for Preview (or Production). Account deletion returns “not configured” until the Supabase **secret** (service role) key is added server-only in [Vercel env settings](https://vercel.com/jimbook/hui/settings/environment-variables) for Preview (and Production when ready). Value from Supabase → Project Settings → API → `service_role` secret.

## Deferred decisions

- Hosting provider beyond initial Vercel trials (app must stay portable)
- shadcn/ui adoption timing (add when UI work begins)
- Push notification channel for PWA reminders
- Email-based group invitations (HUI-007 adds members by existing user ID only)
- **Social authentication:** Google is implemented on the Hui side (HUI-012), enabled in `providers.ts`, and enabled in Supabase Auth. Verify production sign-in before treating it as live. Microsoft/Azure, Meta/Facebook, and Apple remain backlog. Apple Sign in with Apple requires the paid Apple Developer Program — defer Apple activation until closer to launch. One Hui user identity via Supabase Auth; link identities with Supabase rules, not email-only matching (not implemented yet).
