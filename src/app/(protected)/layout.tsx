import { redirect } from "next/navigation";

import { ensureUserProfile } from "@/lib/profiles/ensure-profile";
import { createClient } from "@/lib/supabase/server";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  const displayName =
    (user.user_metadata?.display_name as string | undefined) ??
    user.email?.split("@")[0] ??
    "Member";
  const ensured = await ensureUserProfile(supabase, user.id, displayName);
  if (!ensured.ok) {
    throw new Error(ensured.error);
  }

  return children;
}
