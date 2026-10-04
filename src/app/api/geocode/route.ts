import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { getGeocodingProvider, searchGeocodeAddresses } from "@/lib/maps/geocoding";

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const query = url.searchParams.get("q") ?? "";
  const country = url.searchParams.get("country") ?? undefined;

  if (!getGeocodingProvider()) {
    return NextResponse.json({ configured: false, results: [] });
  }

  const results = await searchGeocodeAddresses(query, {
    countryCode: country,
    limit: 5,
  });

  return NextResponse.json({ configured: true, results });
}
