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

## Data and privacy

- **One event table.** Recurring and one-off gatherings are both `events`. A one-off row has no `recurrence_series_id`. Do not add a parallel one-off schema.
- **History survives leaving.** Membership removal sets `group_memberships.status` to `removed` and does not delete gathering rows. Historical facts reference `profiles.id`. Hosts, contributions, and memory attendees also store the display name taken at insert. Those foreign keys are `ON DELETE RESTRICT`.
- **Dietary data is private by default.** Other members can read an entry only through `dietary_entry_shares`, and only while both people are active in that group. Categories are self-reported labels, not medical or "allergen-free" claims.
- **Availability can be private.** `event_responses.visibility` is `group` or `private`. Other members cannot read `private` rows. Do not widen that policy so the client can compute consensus.
- **Group rules are columns** on `group_settings` (proposer rights, event modes, maybe responses, minimum attendees, deadline hours, consensus rule, vetoes, reconnect). Do not replace that set with a JSON settings blob.
- **Households are optional** coordination units inside a group. They are not the record of attendance, availability, or diet.
- **RLS membership helpers** (`is_active_member`, `is_group_admin`, `is_group_owner`, and the dietary visibility helpers) are `SECURITY DEFINER` with a fixed `search_path`. They exist so policies do not recurse through `group_memberships`. They answer only whether `auth.uid()` may act.
- **Lifecycle stays in the application.** The database stores event status and group rules. It does not trigger consensus, vetoes, or status transitions. It does reject writes that break tenancy, `who_may_propose`, the one-off/recurring flags, or a disabled maybe response.
- **Ownership transfer** is `transfer_group_ownership`. Direct updates to `groups.owner_id` or the owner membership are rejected.
