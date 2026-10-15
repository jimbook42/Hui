"use client";

import { useCallback, useState } from "react";

import { fetchMemberGroupInviteLinkAction } from "@/app/groups/invite-actions";
import { GroupInviteIntroSheet } from "@/components/groups/group-invite-intro-sheet";
import { InviteLinkFallbackSheet } from "@/components/groups/invite-link-fallback-sheet";
import { useGroupInviteFlow } from "@/components/groups/use-group-invite-flow";
import { PeopleIcon } from "@/components/hui/icons";
import { buildGroupInviteUrl } from "@/domain/invites/urls";
import { cn } from "@/lib/ui/cn";

function clientAppOrigin(fallback?: string): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configured) {
    return configured.replace(/\/$/, "");
  }
  if (fallback) {
    return fallback;
  }
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  return "";
}

type GroupInviteShareBlockProps = {
  groupName: string;
  /** When omitted, the link is fetched when the member opens invite UI (`groupId` required). */
  inviteToken?: string;
  groupId?: string;
  appOrigin?: string;
  /** When set, invite link opens this hui after join. */
  focusEventId?: string;
  buttonLabel?: string;
  /** Primary hero card on the group tab (green surface). */
  variant?: "onPrimary" | "page" | "welcome" | "card";
  className?: string;
};

export function GroupInviteShareBlock({
  groupName,
  inviteToken: inviteTokenProp,
  groupId,
  appOrigin: appOriginProp,
  focusEventId,
  buttonLabel = "Invite",
  variant = "page",
  className,
}: GroupInviteShareBlockProps) {
  const [resolveError, setResolveError] = useState<string | null>(null);
  const [resolvePending, setResolvePending] = useState(false);

  const staticInviteUrl =
    inviteTokenProp && appOriginProp
      ? buildGroupInviteUrl(appOriginProp, inviteTokenProp, { focusEventId })
      : "";

  const {
    introOpen,
    fallbackOpen,
    getLinkPending,
    openIntro,
    closeIntro,
    closeFallback,
    getLink,
  } = useGroupInviteFlow(staticInviteUrl, groupName);

  const [fallbackInviteUrl, setFallbackInviteUrl] = useState(staticInviteUrl);
  const inviteUrl = staticInviteUrl || fallbackInviteUrl;

  const resolveInviteUrl = useCallback(async (): Promise<string | null> => {
    if (staticInviteUrl) {
      return staticInviteUrl;
    }
    if (!groupId) {
      setResolveError("Invite link is not available.");
      return null;
    }

    setResolvePending(true);
    setResolveError(null);
    try {
      const linkResult = await fetchMemberGroupInviteLinkAction(groupId);
      if (linkResult.error) {
        setResolveError(linkResult.error);
        return null;
      }
      const token = linkResult.token;
      if (!token) {
        setResolveError("Could not load invite link.");
        return null;
      }

      const origin = clientAppOrigin(appOriginProp);
      if (!origin) {
        setResolveError("Could not determine app URL for invite link.");
        return null;
      }

      const url = buildGroupInviteUrl(origin, token, { focusEventId });
      setFallbackInviteUrl(url);
      return url;
    } finally {
      setResolvePending(false);
    }
  }, [appOriginProp, focusEventId, groupId, staticInviteUrl]);

  const handleOpenIntro = useCallback(() => {
    void (async () => {
      const url = await resolveInviteUrl();
      if (url) {
        openIntro(url);
      }
    })();
  }, [openIntro, resolveInviteUrl]);

  const buttonClassName =
    variant === "onPrimary"
      ? "hui-focus-ring inline-flex min-h-11 items-center gap-2 rounded-full bg-[var(--accent-clay)] px-5 text-sm font-extrabold text-[#1a4331] hui-shadow-sm"
      : variant === "welcome"
        ? "hui-focus-ring inline-flex w-full min-h-14 items-center justify-center gap-2 rounded-full bg-primary px-6 text-base font-extrabold text-primary-foreground hui-shadow-md"
        : variant === "card"
          ? "hui-focus-ring relative z-10 inline-flex min-h-10 items-center gap-1.5 rounded-full border-2 border-border bg-surface px-4 text-sm font-extrabold text-foreground hui-shadow-sm"
          : "hui-focus-ring inline-flex min-h-11 items-center gap-2 rounded-full bg-primary px-5 text-sm font-extrabold text-primary-foreground hui-shadow-sm";

  const iconSize = variant === "welcome" ? 20 : 18;
  const pending = resolvePending || getLinkPending;

  return (
    <>
      <button
        type="button"
        onClick={handleOpenIntro}
        disabled={pending}
        className={cn(buttonClassName, className)}
      >
        <PeopleIcon size={iconSize} />
        {pending ? "Loading…" : buttonLabel}
      </button>
      {resolveError ? (
        <p className="mt-1 text-xs font-semibold text-destructive" role="alert">{resolveError}</p>
      ) : null}
      <GroupInviteIntroSheet
        open={introOpen}
        groupName={groupName}
        onClose={closeIntro}
        onGetLink={() => void getLink()}
        getLinkPending={getLinkPending}
      />
      <InviteLinkFallbackSheet
        open={fallbackOpen}
        inviteUrl={inviteUrl}
        onClose={closeFallback}
      />
    </>
  );
}
