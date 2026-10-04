import { signOutAction } from "@/app/auth/actions";
import { AppShell } from "@/components/app/app-shell";
import { HuiSurface } from "@/components/hui/hui-surface";
import { avatarToneClass, initialsFor } from "@/components/hui/avatar-stack";
import { ProfileHubLink } from "@/components/profile/profile-hub-link";
import { cn } from "@/lib/ui/cn";
import { getServerAuthUser, getServerSupabase } from "@/lib/auth/server-session";
import { devTimed } from "@/lib/perf/dev-server-timing";

export default async function ProfilePage() {
  const user = await devTimed("profile-page:getUser", () => getServerAuthUser());
  if (!user) {
    return null;
  }

  const supabase = await getServerSupabase();
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .maybeSingle();

  const displayName = profile?.display_name?.trim() || user.email || "You";

  return (
    <AppShell title="Profile" subtitle="Settings and preferences for your account.">
      <div className="space-y-6">
        <HuiSurface tone="sage" shape="organic" padding="lg" className="hui-rise flex items-center gap-4">
          <span
            aria-hidden="true"
            className={cn(
              "hui-shape-blob-a flex h-16 w-16 shrink-0 items-center justify-center text-xl font-black text-foreground",
              avatarToneClass(user.id),
            )}
          >
            {initialsFor(displayName)}
          </span>
          <div className="min-w-0">
            <p className="truncate text-xl font-extrabold text-foreground">{displayName}</p>
            <p className="truncate text-sm font-semibold text-muted-foreground">{user.email ?? ""}</p>
          </div>
        </HuiSurface>

        <nav className="space-y-3" aria-label="Profile settings">
          <ProfileHubLink
            href="/profile/account"
            title="Account"
            description="Display name and sign-in details"
          />
          <ProfileHubLink
            href="/profile/groups"
            title="Hui groups"
            description="Households and how you appear in each group"
          />
          <ProfileHubLink
            href="/profile/hosting"
            title="Hosting"
            description="How you feel about hosting in each group"
          />
          <ProfileHubLink
            href="/profile/dietary"
            title="Dietary & food"
            description="Your dietary information and sharing"
          />
          <ProfileHubLink
            href="/profile/notifications"
            title="Notifications"
            description="Push alerts and notification types"
          />
          <ProfileHubLink
            href="/profile/appearance"
            title="Appearance"
            description="Light, dark, or match your device"
          />
          <ProfileHubLink
            href="/profile/install"
            title="Install Hui"
            description="Add Hui to your home screen"
          />
        </nav>

        <HuiSurface elevated padding="md">
          <p className="text-sm font-semibold text-muted-foreground">
            Sign out of Hui on this device. You can sign in again at any time.
          </p>
          <form action={signOutAction} className="mt-4">
            <button type="submit" className="hui-btn hui-btn-secondary rounded-full hui-focus-ring">
              Sign out
            </button>
          </form>
        </HuiSurface>
      </div>
    </AppShell>
  );
}
