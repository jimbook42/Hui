"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Revalidate server components after a server action returns success or error. */
export function useActionStateRefresh(
  state: { message?: string; error?: string },
): void {
  const router = useRouter();
  useEffect(() => {
    if (state.message || state.error) {
      router.refresh();
    }
  }, [state.message, state.error, router]);
}
