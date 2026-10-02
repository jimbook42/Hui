import { updateProfileAction } from "@/app/auth/actions";
import { AppShell } from "@/components/app/app-shell";
import { AuthField, AuthForm } from "@/components/auth/auth-form";
import { AccountActionsSection } from "@/components/profile/account-actions-section";
import { SettingsSection } from "@/components/profile/settings-section";
import { authMethodLabelsForUser } from "@/lib/auth/auth-methods";
import { createClient } from "@/lib/supabase/server";

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user!.id)
    .maybeSingle();

  const authMethods = user ? authMethodLabelsForUser(user) : [];

  return (
    <AppShell title="Account settings">
      <p className="mb-8 text-sm text-zinc-600 dark:text-zinc-400">
        Manage your Hui profile and sign-in details.
      </p>

      <div className="space-y-8">
        <SettingsSection
          title="Profile"
          description="Your display name is visible to people who share a group with you."
        >
          <AuthForm
            action={updateProfileAction}
            submitLabel="Save display name"
            refreshOnSuccess
          >
            <AuthField
              label="Display name"
              name="display_name"
              autoComplete="name"
              defaultValue={profile?.display_name ?? ""}
            />
          </AuthForm>

          <dl className="mt-6 space-y-4 border-t border-zinc-200 pt-6 dark:border-zinc-800">
            <div>
              <dt className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                Account email
              </dt>
              <dd className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                {user?.email ?? "—"}
              </dd>
              <p className="mt-1 text-xs text-zinc-500">
                Used to sign in. Contact support if you need to change it.
              </p>
            </div>

            {authMethods.length > 0 ? (
              <div>
                <dt className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                  Sign-in methods
                </dt>
                <dd className="mt-2">
                  <ul className="flex flex-wrap gap-2">
                    {authMethods.map((method) => (
                      <li
                        key={method}
                        className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-medium text-zinc-700 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300"
                      >
                        {method}
                      </li>
                    ))}
                  </ul>
                </dd>
              </div>
            ) : null}

            <div>
              <dt className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                Member ID
              </dt>
              <dd className="mt-1 font-mono text-xs break-all text-zinc-600 dark:text-zinc-400">
                {user?.id}
              </dd>
              <p className="mt-1 text-xs text-zinc-500">
                Share this with a group admin if they need to add you to a group.
              </p>
            </div>
          </dl>
        </SettingsSection>

        <SettingsSection
          title="Account"
          description="Sign out or permanently delete your Hui account."
        >
          <AccountActionsSection />
        </SettingsSection>
      </div>
    </AppShell>
  );
}
