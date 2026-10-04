import { signOutAction } from "@/app/auth/actions";

import { DeleteAccountSection } from "./delete-account-section";

export function AccountActionsSection() {
  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm text-muted-foreground">
          Sign out of Hui on this device. You can sign in again at any time.
        </p>
        <form action={signOutAction} className="mt-4">
          <button
            type="submit"
            className="hui-btn hui-btn-secondary rounded-full hui-focus-ring"
          >
            Sign out
          </button>
        </form>
      </div>
      <DeleteAccountSection />
    </div>
  );
}
