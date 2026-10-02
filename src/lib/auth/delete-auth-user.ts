import type { SupabaseClient } from "@supabase/supabase-js";

export type DeleteAuthUserResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Deletes a Supabase Auth user and verifies the identity no longer exists.
 * Requires a server-only client with the secret key.
 */
export async function deleteAuthUserWithVerification(
  admin: SupabaseClient,
  userId: string,
): Promise<DeleteAuthUserResult> {
  const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
  if (deleteError) {
    return {
      ok: false,
      error: deleteError.message,
    };
  }

  const { data, error: getError } = await admin.auth.admin.getUserById(userId);
  if (data?.user) {
    return {
      ok: false,
      error: "Auth user still exists after deletion.",
    };
  }

  if (getError && !/not found|404|User not found/i.test(getError.message)) {
    return {
      ok: false,
      error: getError.message,
    };
  }

  return { ok: true };
}
