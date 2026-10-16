import type { SupabaseClient } from "@supabase/supabase-js";

import { homeLocationFromProfileRow } from "@/domain/profile/home-location";
import type { ProfileHomeLocation } from "@/domain/profile/home-location";

type HomeLocationRow = {
  home_location_label: string | null;
  home_location_lat: number | string | null;
  home_location_lng: number | string | null;
};

function rowFromRpc(data: HomeLocationRow | HomeLocationRow[] | null): HomeLocationRow | null {
  if (!data) {
    return null;
  }
  return Array.isArray(data) ? (data[0] ?? null) : data;
}

/**
 * Loads the caller's saved home location. Uses `my_home_location` when deployed; falls back to
 * direct profile columns when the migration is not applied yet (e.g. live DB during rollout).
 */
export async function fetchMyHomeLocation(
  supabase: SupabaseClient,
  userId: string,
): Promise<ProfileHomeLocation | null> {
  const { data: rpcData, error: rpcError } = await supabase.rpc("my_home_location");
  if (!rpcError) {
    const row = rowFromRpc(rpcData as HomeLocationRow | HomeLocationRow[] | null);
    return row ? homeLocationFromProfileRow(row) : null;
  }

  const { data: profileRow } = await supabase
    .from("profiles")
    .select("home_location_label, home_location_lat, home_location_lng")
    .eq("id", userId)
    .maybeSingle();

  return profileRow ? homeLocationFromProfileRow(profileRow) : null;
}
