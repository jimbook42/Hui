# TODO

Unresolved implementation questions only. Add items when a real decision or task is blocked.

- [ ] Decide when to add shadcn/ui (likely start of Phase 1 UI).
- [ ] **HUI-022A.4 live Grok QA** — Family Dinner: accept → Ask to swap (accepted host) → replacement accept → Main lifecycle while proposing.
- [ ] **HUI-022B live QA** — share invite link → sign-up/sign-in return → join; regenerate invalidates old link.
- [ ] HUI-022 remainder — named invites, invitation records/lifecycle, invitation notifications (email is HUI-028; Web Push does not notify non-members).
- [ ] **HUI-023 production** — set `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, and confirm `SUPABASE_SECRET_KEY` on Vercel; apply `20261004020000_web_push_notifications.sql`; manual browser QA for permission granted, denied, and unsupported.
- [ ] **HUI-023 security advisor** — run Supabase database advisors on the linked project after the migration is applied.
