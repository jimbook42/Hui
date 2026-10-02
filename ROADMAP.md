# Hui roadmap

**Phase:** 4 — Scheduling and consensus  
**Milestone:** Social auth  
**Current ticket:** none (HUI-015 complete)  
**Overall progress:** HUI-015 account settings foundation shipped — display name editing, account email, sign-in methods readout, sign-out, and deletion entry point

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
- [x] HUI-012B — Account deletion and re-registration (two-step UI; Auth delete then RPC; verified `deleteUser`; manual preview passed: Auth user removed, old credentials fail, same email re-registers as a new account)
- [x] HUI-013 — Microsoft/Azure OAuth (Hui-side; Supabase `azure` provider must be enabled for live sign-in)
- [x] HUI-013A — Azure `email` scope on `signInWithOAuth` (Supabase rejects the callback without it; live sign-in retest still required)
- [x] HUI-014 — Facebook/Meta OAuth (Hui-side; production OAuth start verified; end-to-end Facebook login retest still recommended)
- [x] HUI-015 — Profile, identity and account settings foundation (display name, account email, sign-in methods readout, sign-out, deletion entry point)

## Phase 1 — Identity, groups and membership

- [x] HUI-006 — Auth flows and profile/person model
- [x] HUI-007 — Group creation, membership roles, administration (settings view/edit; add by user ID)
- [x] HUI-015 — Profile and account settings UI (see Phase 0)

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
- [x] Microsoft / Azure OAuth integration (HUI-013; HUI-013A adds the required Azure `email` scope — production sign-in retest still required)
- [x] Meta / Facebook OAuth integration (HUI-014 — Hui-side; production OAuth redirect verified; full login retest still recommended)
- [ ] Apple Sign in with Apple integration (requires Apple Developer Program membership)

## Known blockers

- None.

## Deferred decisions

- Hosting provider beyond initial Vercel trials (app must stay portable)
- shadcn/ui adoption timing (add when UI work begins)
- Push notification channel for PWA reminders
- Email-based group invitations (HUI-007 adds members by existing user ID only)
- **Social authentication:** Google (HUI-012), Microsoft/Azure (HUI-013), and Facebook (HUI-014) are implemented on the Hui side when enabled in `providers.ts`. Each provider must also be enabled and configured in Supabase Auth (client secrets stay in the dashboard). Apple remains backlog. Apple Sign in with Apple requires the paid Apple Developer Program — defer Apple activation until closer to launch. One Hui user identity via Supabase Auth; link identities with Supabase rules, not email-only matching (not implemented yet).
