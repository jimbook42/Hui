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
