import { signOutAction } from "@/app/auth/actions";

import { DeleteAccountSection } from "./delete-account-section";

export function AccountActionsSection() {
  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Sign out of Hui on this device. You can sign in again at any time.
        </p>
        <form action={signOutAction} className="mt-4">
          <button
            type="submit"
            className="rounded-lg border border-zinc-300 px-4 py-2.5 text-sm font-medium text-zinc-800 transition hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-950"
          >
            Sign out
          </button>
        </form>
      </div>
      <DeleteAccountSection />
    </div>
  );
}
