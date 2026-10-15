"use client";

import { useCallback, useState } from "react";

import { shareInviteLink } from "@/domain/invites/share";

export function useGroupInviteFlow(inviteUrl: string, groupName?: string) {
  const [activeInviteUrl, setActiveInviteUrl] = useState(inviteUrl);
  const [introOpen, setIntroOpen] = useState(false);
  const [fallbackOpen, setFallbackOpen] = useState(false);
  const [getLinkPending, setGetLinkPending] = useState(false);

  const openIntro = useCallback((url?: string) => {
    if (url) {
      setActiveInviteUrl(url);
    }
    setIntroOpen(true);
  }, []);

  const closeIntro = useCallback(() => {
    setIntroOpen(false);
  }, []);

  const closeFallback = useCallback(() => {
    setFallbackOpen(false);
  }, []);

  const getLink = useCallback(async () => {
    setGetLinkPending(true);
    try {
      const result = await shareInviteLink(activeInviteUrl, groupName);
      if (result.outcome === "shared") {
        setIntroOpen(false);
      } else if (result.outcome === "fallback") {
        setIntroOpen(false);
        setFallbackOpen(true);
      } else if (result.outcome === "cancelled") {
        // Keep intro open so they can try again.
      }
    } finally {
      setGetLinkPending(false);
    }
  }, [activeInviteUrl, groupName]);

  return {
    introOpen,
    fallbackOpen,
    getLinkPending,
    openIntro,
    closeIntro,
    closeFallback,
    getLink,
  };
}
