import "server-only";

import type { User } from "@supabase/supabase-js";
import { cache } from "react";

import { createClient } from "@/lib/supabase/server";

/** One Supabase server client per React request (Server Components / Actions). */
export const getServerSupabase = cache(createClient);

/**
 * Resolves the authenticated user once per request.
 * Deduplicates repeated `auth.getUser()` across layout, pages, and shell children.
 */
export const getServerAuthUser = cache(async (): Promise<User | null> => {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

/**
 * Reads the signed-in user from the session cookie without an Auth server round-trip.
 * Use for high-frequency mutations where RLS enforces access; prefer getServerAuthUser when
 * you need a live revocation check.
 */
export const getServerAuthUserFromSession = cache(async (): Promise<User | null> => {
  const supabase = await getServerSupabase();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.user ?? null;
});
