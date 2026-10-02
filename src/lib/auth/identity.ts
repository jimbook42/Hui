/**
 * Canonical Hui user identity is Supabase Auth `auth.users.id` (session `user.id`).
 *
 * `profiles.id`, group memberships, ownership, and RLS policies must use that uuid.
 * Email is an auth identifier only; do not key application data or merge accounts by email alone.
 *
 * Future social sign-in should link identities through Supabase Auth identity linking where supported,
 * preserving one Hui user per auth user — not implemented in groundwork tickets.
 */
export const CANONICAL_USER_ID_FIELD = "auth.users.id" as const;
