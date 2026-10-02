import { updateProfileAction } from "@/app/auth/actions";
import { AppShell } from "@/components/app/app-shell";
import { AuthField, AuthForm } from "@/components/auth/auth-form";
import { DeleteAccountSection } from "@/components/profile/delete-account-section";
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

  return (
    <AppShell title="Your profile">
      <p className="mb-6 text-sm text-zinc-600 dark:text-zinc-400">
        Account email:{" "}
        <span className="font-mono text-zinc-800 dark:text-zinc-200">{user?.email}</span>
      </p>
      <AuthForm action={updateProfileAction} submitLabel="Save profile">
        <AuthField
          label="Display name"
          name="display_name"
          autoComplete="name"
          defaultValue={profile?.display_name ?? ""}
        />
      </AuthForm>
      <p className="mt-6 text-sm text-zinc-600 dark:text-zinc-400">
        Member ID (share with a group admin to be added):
      </p>
      <p className="mt-1 font-mono text-xs text-zinc-800 break-all dark:text-zinc-200">
        {user?.id}
      </p>
      <p className="mt-4 text-xs text-zinc-500">
        Your display name is visible to people who share a group with you.
      </p>
      <DeleteAccountSection />
    </AppShell>
  );
}
