import { redirect } from "next/navigation";

import { ensureUserProfile } from "@/lib/profiles/ensure-profile";
import { initialDisplayNameFromAuthMetadata } from "@/lib/profiles/initial-display-name";
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

  const { data: profileRow } = await supabase
    .from("profiles")
    .select("account_deleted_at")
    .eq("id", user.id)
    .maybeSingle();

  if (profileRow?.account_deleted_at) {
    await supabase.auth.signOut();
    redirect("/sign-in?deleted=1");
  }

  const ensured = await ensureUserProfile(
    supabase,
    user.id,
    initialDisplayNameFromAuthMetadata(user.user_metadata, user.email),
  );
  if (!ensured.ok) {
    throw new Error(ensured.error);
  }

  return children;
}
