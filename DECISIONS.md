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
- **Lifecycle stays in the application.** The database stores event status and group rules. It does not trigger consensus, vetoes, or status transitions. It does reject writes that break tenancy, `who_may_propose`, the one-off/recurring flags, a disabled maybe response, or a client attempt to confirm an event without `finalise_event`.

## Consensus and finalisation (HUI-010)

- **Accepting responses.** `yes` accepts. `no` does not. A missing response does not. `maybe` accepts only when `maybe_responses_enabled` is true ("can make work"); otherwise it is recorded as maybe and does not accept. Removed members are not eligible.
- **Minimum attendees** is always required: the accepting count must reach `group_settings.minimum_attendees`. That column is the only minimum. It is not a second quota.
- **`minimum_attendees` rule** is that same floor and nothing further.
- **`all_active_members`** means every current active member must accept, and the minimum still applies.
- **`required_participants`** means every active member with `group_memberships.consensus_required` must accept, and the minimum still applies. If nobody is flagged, that rule adds no extra people. There is no settings UI yet for the flag; the column is the source of truth.
- **One confirmed time.** An authorised member (owner, admin, or the event creator — the existing manage permission) chooses one proposed candidate that currently passes. The server re-checks that candidate inside `finalise_event`. It does not substitute a different candidate. Display order, and `selectPassingCandidate`, sort by `starts_at` then candidate id.
- **Status path.** Confirmation is `proposing` → `confirmed` only. The selected candidate becomes the event start and end. Other candidates stay proposed but can no longer be changed, and scheduling responses stop.
- **Proposal deadlines** stay the existing `proposal_deadline_hours` column. No event-level deadline is stored or enforced yet, so HUI-010 does not invent one.
- **Ownership transfer** is `transfer_group_ownership`. Direct updates to `groups.owner_id` or the owner membership are rejected.
