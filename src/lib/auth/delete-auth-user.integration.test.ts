import { randomUUID } from "node:crypto";

import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import { deleteAuthUserWithVerification } from "@/lib/auth/delete-auth-user";
import { getPublicSupabaseConfig, hasPublicSupabaseConfig } from "@/lib/supabase/env";

function canRunAuthDeletionIntegration(): boolean {
  return (
    hasPublicSupabaseConfig() &&
    Boolean(process.env.SUPABASE_SECRET_KEY?.trim())
  );
}

function createAdminClient() {
  const secretKey = process.env.SUPABASE_SECRET_KEY!.trim();
  const { url } = getPublicSupabaseConfig();
  return createClient(url, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

describe("Supabase Auth deletion integration", () => {
  it.skipIf(!canRunAuthDeletionIntegration())(
    "deleteAuthUserWithVerification removes the auth user",
    async () => {
      const admin = createAdminClient();
      const email = `hui-012b-delete-${randomUUID()}@example.com`;
      const password = `HuiDel-${randomUUID()}`;

      const { data: created, error: createError } =
        await admin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
        });

      expect(createError).toBeNull();
      const userId = created.user!.id;

      const deleted = await deleteAuthUserWithVerification(admin, userId);
      expect(deleted).toEqual({ ok: true });

      const { data: after, error: getError } =
        await admin.auth.admin.getUserById(userId);
      expect(after?.user).toBeFalsy();
      expect(getError?.message ?? "").toMatch(/not found|404|User not found/i);

      const { url, publishableKey } = getPublicSupabaseConfig();
      const anon = createClient(url, publishableKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const { error: signInError } = await anon.auth.signInWithPassword({
        email,
        password,
      });
      expect(signInError).toBeTruthy();
    },
    30_000,
  );
});
