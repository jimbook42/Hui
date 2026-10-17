import { redirect } from "next/navigation";

import { DisplayNamePromptFlow } from "@/components/profile/display-name-prompt-flow";
import { HuiSurface } from "@/components/hui/hui-surface";
import { ProfileSectionShell } from "@/components/profile/profile-hub-link";
import {
  bestGuessDisplayNameForPrompt,
  shouldPromptForDisplayName,
} from "@/lib/profiles/display-name-prompt";
import { getServerAuthUser, getServerSupabase } from "@/lib/auth/server-session";

export default async function ProfileDisplayNamePromptPage() {
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
    redirect("/dashboard");
  }

  const defaultDisplayName = bestGuessDisplayNameForPrompt(
    profile?.display_name,
    user.email,
  );

  return (
    <ProfileSectionShell
      title="Your name"
      description="Shown to people in your groups."
    >
      <HuiSurface padding="lg" shape="organic" elevated>
        <DisplayNamePromptFlow defaultDisplayName={defaultDisplayName} />
      </HuiSurface>
    </ProfileSectionShell>
  );
}
