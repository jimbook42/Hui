"use client";

import { useEffect, useState } from "react";

type AuthSlowActionNoticeProps = {
  pending: boolean;
};

const SLOW_MS = 8_000;
const TIMEOUT_MS = 25_000;

function AuthSlowActionNoticeInner() {
  const [slow, setSlow] = useState(false);
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    const slowId = window.setTimeout(() => setSlow(true), SLOW_MS);
    const timeoutId = window.setTimeout(() => setTimedOut(true), TIMEOUT_MS);
    return () => {
      window.clearTimeout(slowId);
      window.clearTimeout(timeoutId);
    };
  }, []);

  if (timedOut) {
    return (
      <p className="hui-message-note mt-3" role="status">
        This is taking longer than usual. Check your connection and try again, or use a different
        sign-in option.
      </p>
    );
  }

  if (slow) {
    return (
      <p className="text-sm text-muted-foreground mt-3" role="status">
        Still signing you in…
      </p>
    );
  }

  return null;
}

export function AuthSlowActionNotice({ pending }: AuthSlowActionNoticeProps) {
  if (!pending) {
    return null;
  }
  return <AuthSlowActionNoticeInner />;
}
