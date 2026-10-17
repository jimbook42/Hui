import Link from "next/link";

import { HuiSurface } from "@/components/hui/hui-surface";
import { shouldPromptForDisplayName } from "@/lib/profiles/display-name-prompt";
import { getServerAuthUser, getServerSupabase } from "@/lib/auth/server-session";

export async function DisplayNamePromptGate() {
  const user = await getServerAuthUser();
  if (!user) {
    return null;
  }

  const supabase = await getServerSupabase();
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .maybeSingle();

  if (
    !shouldPromptForDisplayName({
      displayName: profile?.display_name,
      email: user.email,
      userMetadata: user.user_metadata,
    })
  ) {
    return null;
  }

  return (
    <HuiSurface tone="clay" shape="soft" padding="md" className="mb-4">
      <p className="font-extrabold text-foreground">What should your group call you?</p>
      <p className="mt-1 text-sm font-semibold text-muted-foreground">
        Your name still looks like your email address. You can choose how people see you in groups.
      </p>
      <Link
        href="/profile/display-name"
        className="hui-btn hui-btn-primary mt-4 inline-flex min-h-11 items-center rounded-full px-5 text-sm font-bold hui-focus-ring"
      >
        Choose your name
      </Link>
    </HuiSurface>
  );
}
