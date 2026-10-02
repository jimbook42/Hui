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
