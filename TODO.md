# TODO

Unresolved implementation questions only. Add items when a real decision or task is blocked.

- [x] **HUI-026A** — Event flow foundation + staged proposal (staged creator flow + atomic `propose_group_event`).
- [x] **HUI-026B** — Invitee response flow + structured alternative-time intent (`/events/[eventId]/respond`).
- [x] **HUI-026C** — Event-oriented dashboard + event entry (shared attention taxonomy, section hierarchy, card CTAs).
- [x] **HUI-026D** — Separate event management/admin surface (incl. hard event delete where policy allows).
- [x] **HUI-027** — Onboarding & setup architecture (see WORKLOG 2026-10-05).
- [x] **HUI-026E** — Contribution coordination finish (see WORKLOG 2026-10-05).
- [x] **HUI-026F** — Generic decision polls (see WORKLOG 2026-10-05).
- [x] **HUI-026U (redesign + 026U.3–U.4)** — Full UI/UX rewrite plus map, optional end time, post-confirmation attendance, dietary scope UI, PWA install, profile settings hub, auth entry → dashboard, address-search seam, host-confirmed place, food-involvement gating (see WORKLOG). Follow-ups: refresh stale e2e specs; live system-theme change without reload; real-device PWA check after deploy. **U.4 polish:** Geoapify global bias, notification onboarding, propose-time Continue UX, food UI fixes (WORKLOG 2026-10-05).
- [x] **HUI-026P** — Performance audit + core interaction speed (baseline documented in WORKLOG; dev perf via `HUI_DEV_PERF=1`).
- [x] **HUI-026P.1** — Systemic latency diagnosis + common path fixes (see WORKLOG; physical Android re-measurement still required).
- [x] **HUI-026P.2** — End-to-end interaction latency audit (`docs/performance/HUI-026P.2-audit.md`; Android timings still manual).
- [x] **HUI-026P.3** — Navigation & data-loading (`docs/performance/HUI-026P.3-audit.md`; Android re-measure after deploy).
- [ ] Decide when to add shadcn/ui (likely start of Phase 1 UI).
- [x] Member hosting standing **I always host** (`always` enum + selection preference; not auto-accept).
- [ ] **HUI-022A.4 live Grok QA** — Family Dinner: accept → Ask to swap (accepted host) → replacement accept → Main lifecycle while proposing.
- [ ] **HUI-022B live QA** — share invite link → sign-up/sign-in return → join; regenerate invalidates old link.
- [ ] HUI-022 remainder — named invites, invitation records/lifecycle, invitation notifications (email is HUI-028; Web Push does not notify non-members).
- [ ] Recurrence configuration and user-friendly recurrence UX (weeks/months/N intervals, weekday patterns, time windows, and previews).
