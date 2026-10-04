import { updateProfileAction } from "@/app/auth/actions";
import { AuthField, AuthForm } from "@/components/auth/auth-form";
import { AccountActionsSection } from "@/components/profile/account-actions-section";
import { ProfileSectionShell } from "@/components/profile/profile-hub-link";
import { SettingsSection } from "@/components/profile/settings-section";
import { authMethodLabelsForUser } from "@/lib/auth/auth-methods";
import { getServerAuthUser, getServerSupabase } from "@/lib/auth/server-session";

export default async function ProfileAccountPage() {
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

  const authMethods = authMethodLabelsForUser(user);

  return (
    <ProfileSectionShell title="Account" description="Your display name and sign-in details.">
      <SettingsSection
        title="Profile"
        description="Your display name is visible to people who share a group with you."
      >
        <AuthForm action={updateProfileAction} submitLabel="Save display name">
          <AuthField
            label="Display name"
            name="display_name"
            autoComplete="name"
            defaultValue={profile?.display_name ?? ""}
          />
        </AuthForm>

        <dl className="mt-6 space-y-4 pt-6">
          <div>
            <dt className="text-sm font-bold text-foreground">Account email</dt>
            <dd className="mt-1 text-sm text-muted-foreground">{user.email ?? "—"}</dd>
            <p className="mt-1 text-xs text-muted-foreground">
              Used to sign in. Contact support if you need to change it.
            </p>
          </div>

          {authMethods.length > 0 ? (
            <div>
              <dt className="text-sm font-bold text-foreground">Sign-in methods</dt>
              <dd className="mt-2">
                <ul className="flex flex-wrap gap-2">
                  {authMethods.map((method) => (
                    <li
                      key={method}
                      className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-foreground"
                    >
                      {method}
                    </li>
                  ))}
                </ul>
              </dd>
            </div>
          ) : null}

          <div>
            <dt className="text-sm font-bold text-foreground">Member ID</dt>
            <dd className="mt-1 font-mono text-xs break-all text-muted-foreground">{user.id}</dd>
            <p className="mt-1 text-xs text-muted-foreground">
              Share this with a group admin if they need to add you to a group.
            </p>
          </div>
        </dl>
      </SettingsSection>

      <SettingsSection title="Account actions" description="Sign out or permanently delete your Hui account.">
        <AccountActionsSection />
      </SettingsSection>
    </ProfileSectionShell>
  );
}
