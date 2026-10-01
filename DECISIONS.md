# Architecture and product decisions

Record only decisions future work should not reverse without explicit discussion.

## Backend and hosting

- **Supabase** is the persistent backend and source of truth (Postgres, Auth, RLS, Storage, functions as needed).
- **Hosting** may use Vercel initially for private development; the app must remain portable so hosting can move without moving the database.

## Product scope (MVP)

- **Privacy-first** PWA for recurring groups and gatherings; recurring gatherings are the primary use case.
- **Core promise:** the app proposes, coordinates, and remembers; the group decides; nothing is final until required participants agree.
- **No in-app chat.**
- **Calendar:** export only for MVP. No calendar import, Google/Microsoft connection, free/busy, or clash detection in MVP.
- **One-off events** use the same event/consensus machinery as recurring events (no parallel one-off system).

## Configurable group behaviour

- “Maybe / can make work” responses: configurable; can be disabled per group.
- Minimum acceptable attendees: configurable.
- Proposal deadlines: configurable.
- Admin veto and host veto: configurable.
- Who can propose events: configurable per group.
- Admins can add and remove members.

## Engineering

- **Authorisation:** never rely on client-side checks alone; Supabase RLS must enforce data access.
- **Layering:** keep domain rules out of UI components where practical (UI → application → domain → persistence).
