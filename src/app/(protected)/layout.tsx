import { redirect } from "next/navigation";

import { getServerAuthUser, getServerSupabase } from "@/lib/auth/server-session";
import { ensureUserProfile } from "@/lib/profiles/ensure-profile";
import { initialDisplayNameFromAuthMetadata } from "@/lib/profiles/initial-display-name";
import { devTimed } from "@/lib/perf/dev-server-timing";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await devTimed("protected-layout:getUser", () => getServerAuthUser());

  if (!user) {
    redirect("/sign-in");
  }

  const supabase = await getServerSupabase();

  const profileRow = await devTimed("protected-layout:profile-guard", async () => {
    const { data } = await supabase
      .from("profiles")
      .select("id, account_deleted_at")
      .eq("id", user.id)
      .maybeSingle();
    return data;
  });

  if (profileRow?.account_deleted_at) {
    await supabase.auth.signOut({ scope: "global" });
    redirect("/sign-in?deletion_incomplete=1");
  }

  if (!profileRow) {
    const ensured = await devTimed("protected-layout:ensure-profile", () =>
      ensureUserProfile(
        supabase,
        user.id,
        initialDisplayNameFromAuthMetadata(user.user_metadata, user.email),
      ),
    );
    if (!ensured.ok) {
      throw new Error(ensured.error);
    }
  }

  return children;
}
