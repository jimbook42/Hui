# Data model

Implemented schema in `supabase/migrations`. One-off and recurring gatherings share one `events` table. A one-off event has no `recurrence_series_id`.

Photos, notification delivery, fairness scores, and calendar export are not stored yet.

In-app notifications are stored in `member_notifications` (HUI-021). External email/SMS/push delivery is not stored.

## Identity and membership

| Table | Purpose | Relationships and privacy |
| --- | --- | --- |
| `profiles` | Display name for `auth.users` | Created when an auth user is inserted. Dietary data is not on this row. `member_reconnect_reminders_enabled` opts the member out of optional reconnect reminder notifications (default on). A person can read their own profile and the display names of people who share an active membership. |
| `groups` | A gathering circle | `owner_id` mirrors the active owner membership. Active members can read the group. |
| `group_settings` | Rules for that group | One row, created with the group. See columns below. Active members can read; owner and admins can update. |
| `group_memberships` | Person in a group | Role `owner`, `admin`, or `member`. Leaving sets `status` to `removed` and keeps the row. A user may belong to many groups. One active owner per group. |
| `membership_changes` | Append-only membership audit | Written by trigger. Readable by the owner and admins, not by ordinary members. |
| `households`, `household_members` | Optional coordination unit inside one group | A person is in at most one household per group. Household membership is not required. Active group members can read household names and who is grouped together. Members manage their own household through RPCs (`create_household`, `update_household_name`, `add_household_member`, `remove_household_member`); adding someone requires they are already an active member of the same group. Attendance, availability, and dietary data stay on the person. |

`group_settings` columns: who may propose (`admins_only` or `any_member`), whether one-off and recurring events are allowed, whether maybe responses are enabled, minimum attendees, proposal deadline in hours (null means none; not enforced on an event yet), consensus rule (`required_participants`, `minimum_attendees`, or `all_active_members`), admin veto, host veto, and reconnect reminder on/off plus a day count. `group_memberships.consensus_required` marks people the `required_participants` rule refers to. The domain evaluator applies those rules. `maybe` counts as accepting only while maybe responses are enabled. The minimum attendee count always applies.

Initial defaults: any member may propose, both event modes are allowed, maybe responses are enabled, minimum attendees is 1, vetoes and reconnect reminders are off. Groups can change these.

## Gatherings

| Table | Purpose | Relationships and privacy |
| --- | --- | --- |
| `recurrence_series` | Cadence anchor (`week` or `month`, plus an interval and start date) | Belongs to one group. Generating occurrences is application logic, not a trigger. |
| `events` | One gathering | Optional series link. Status is `draft`, `proposing`, `voting`, `awaiting_agreement`, `confirmed`, `reopened`, `completed`, or `cancelled`. Confirmation is only `proposing` → `confirmed`, and only through `finalise_event`, which copies the selected candidate's start and end onto the event. |
| `event_candidates` | Proposed times | At most one `selected` candidate per event. |
| `event_responses` | Yes, no, or maybe for one candidate | `visibility` is `group` or `private`. Group responses are readable by active members. Private responses are readable only by the author, and only while they remain active. Maybe is rejected when the group has disabled it. |
| `host_assignments` | Host offer, acceptance, decline, or swap | A row is either a person or a household. HUI-020 assigns members in the app (`user_id`). `display_name` is copied at insert and kept if the profile is later renamed. History is new rows, not deletes. Accepted hosts on confirmed/completed events feed rotation suggestions and group hosting history; cancelled events are excluded from fairness counts. |
| `contribution_categories` | Group list such as dessert or drinks | Admins maintain it. |
| `event_contributions` | An ask or an accepted contribution | Assignee is optional until someone accepts. `display_name` is copied when an assignee is set. Fairness scores are not stored. |
| `event_memories` | Notes and menu for one event | One memory per event. No photo storage. |
| `event_memory_attendees` | Who was recorded there | The display name is copied at insert. The person must have a membership row in the group, including a removed one. |

## Dietary information

`dietary_entries` belong to the user. `category` is `allergy`, `requirement`, `dislike`, or `preference`. These are self-reported labels, not a medical or "allergen-free" claim.

`dietary_entry_shares` grants one group access to one entry. Another member can read it only when a share exists and both people are still active in that group. Updating or deleting an entry stays with the owner.

## Historical records

| Table | Purpose | Relationships and privacy |
| --- | --- | --- |
| `member_notifications` | In-app activity for one member | Created only through `SECURITY DEFINER` helpers and triggers (not direct client insert). Each row has a kind, short title/body (no private availability or dietary detail), optional `event_id`, and a per-member `dedupe_key`. Members read and mark read their own rows only. Removed members keep no new notifications; opening a link still requires current group/event RLS. |

Responses, hosts, contributions, and memory attendees reference `profiles.id`. Hosts, contributions, and memory attendees also store `display_name` as it was when the row was written. Those foreign keys use `ON DELETE RESTRICT`, so deleting an account cannot erase a gathering. Removing a member does not delete or null those rows; it only marks the membership removed. After that, the person cannot read the group's data. Remaining members still can.

## Account deletion (HUI-012B)

Deleting an account is a deliberate, server-side flow: the authenticated user confirms with `DELETE`, the app removes the Supabase Auth user with the server secret key and verifies it is gone, then Postgres runs `delete_my_account_data()` (identity from `auth.uid()` only). That is **not** one atomic transaction across Auth and Postgres. The success message is shown only when both steps succeed.

**Removed:** all `dietary_entries` (and shares), private `event_responses`, in-app `member_notifications`, household membership rows, active group memberships (status `removed`), and sole-member groups (entire group tree). The profile row is kept but anonymised (`display_name` → `Former member`, `account_deleted_at` set) so historical foreign keys stay valid. The profile no longer references `auth.users` after migration `20261002160000_account_deletion`.

**May remain for other members:** shared events, group-visible availability responses, hosts, contributions, memories, and membership audit rows that already referenced the person. Snapshot `display_name` columns on historical rows are unchanged.

**Ownership:** if the user owns a group with any other active member, deletion is blocked until they call `transfer_group_ownership`. If they are the only active member, the group is deleted with them.

**Re-registration:** the same email can sign up again with a **new** `auth.users.id` and a new profile. Hui does not match on email to old rows. OAuth follows Supabase identity rules for the new account.

## Ownership

The active `owner` membership is the source of truth. `groups.owner_id` follows it. Changing owner is `transfer_group_ownership(group_id, new_owner)`, which the current owner calls. Direct updates to `groups.owner_id` or to the owner membership are rejected.
