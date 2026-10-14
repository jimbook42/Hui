"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export function EventRespondSavedToast() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const shouldShow = searchParams.get("saved") === "1";

  useEffect(() => {
    if (!shouldShow) {
      return;
    }
    const timeoutId = window.setTimeout(() => {
      const url = new URL(window.location.href);
      url.searchParams.delete("saved");
      router.replace(url.pathname + url.search + url.hash, { scroll: false });
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [router, shouldShow]);

  if (!shouldShow) {
    return null;
  }

  return (
    <p
      className="pointer-events-none fixed inset-x-4 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-50 mx-auto max-w-md rounded-hui-lg bg-foreground px-4 py-3 text-center text-sm font-semibold text-background hui-shadow-lg"
      role="status"
    >
      Saved
    </p>
  );
}
