import { HuiBotanical } from "@/components/hui/botanical";
import { HuiLinkButton } from "@/components/hui/hui-button";
import { HuiSurface } from "@/components/hui/hui-surface";
import { HuiLogo } from "@/components/hui/hui-logo";
import { HuiWordmark } from "@/components/hui/hui-wordmark";
import { JoinAuthLinks, JoinInviteButton } from "@/components/join/join-invite-actions";
import { JoinInvitePreview } from "@/components/join/join-invite-preview";
import { gatheringEventTitleForInvite, parseGatheringType } from "@/domain/gathering/type";
import type { InvitePlanningPreview } from "@/domain/invites/presentation";
import type { InvitePlanningContext } from "@/domain/invites/resolve";
import { parseInviteResolvePayload } from "@/domain/invites/resolve";
import { isInviteFocusEventId } from "@/domain/invites/urls";
import { participantRespondPath } from "@/lib/events/paths";
import { createClient } from "@/lib/supabase/server";

type PageProps = {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ event?: string }>;
};

function mapPlanning(planning: InvitePlanningContext | null): InvitePlanningPreview | null {
  if (!planning) {
    return null;
  }

  return {
    eventId: planning.eventId,
    eventTitle: planning.eventTitle,
    status: planning.status,
    planningTargetDate: planning.planningTargetDate,
    proposedStartsAt: planning.proposedStartsAt,
    gathering: {
      type: planning.gatheringType,
      customDescription: planning.gatheringTypeCustom,
      eventTitle: gatheringEventTitleForInvite(
        planning.eventTitle,
        parseGatheringType(planning.gatheringType),
        planning.gatheringTypeCustom,
      ),
    },
  };
}

export default async function JoinInvitePage({ params, searchParams }: PageProps) {
  const { token } = await params;
  const query = await searchParams;
  const focusEventId = isInviteFocusEventId(query.event) ? query.event : null;

  const supabase = await createClient();

  const { data, error } = await supabase.rpc("resolve_group_invite", {
    p_token: token,
    p_focus_event_id: focusEventId,
  });

  const resolved = error ? { status: "invalid" as const } : parseInviteResolvePayload(data);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const timeZone = resolved.status === "invalid" ? "Pacific/Auckland" : resolved.groupTimeZone;

  const planningPreview =
    resolved.status === "invalid" ? null : mapPlanning(resolved.planning);

  return (
    <div className="hui-canvas relative flex min-h-dvh flex-col items-center justify-center px-5 py-12">
      <HuiBotanical />
      <main className="relative z-10 w-full max-w-md">
        <div className="mx-auto mb-7 flex w-fit flex-col items-center gap-2">
          <HuiLogo size={64} priority />
          <HuiWordmark height={36} priority />
        </div>
        <HuiSurface shape="organic" padding="lg" elevated className="hui-rise">
          {resolved.status === "invalid" ? (
            <div className="text-center">
              <h1 className="hui-type-page-title text-foreground">Invite not valid</h1>
              <p className="hui-type-supporting mt-3">This invite link is no longer valid.</p>
              <div className="mt-7 flex justify-center">
                <HuiLinkButton href={user ? "/dashboard" : "/sign-in"} variant="soft">
                  {user ? "Back to dashboard" : "Sign in to Hui"}
                </HuiLinkButton>
              </div>
            </div>
          ) : null}

          {resolved.status === "already_member" ? (
            <div className="text-center">
              <h1 className="hui-type-page-title text-foreground">Already a member</h1>
              <p className="hui-type-supporting mt-3">
                You&apos;re already in{" "}
                <span className="font-extrabold text-foreground">{resolved.groupName}</span>.
              </p>
              <div className="mt-7 flex flex-col gap-3">
                {planningPreview ? (
                  <HuiLinkButton href={participantRespondPath(planningPreview.eventId)} size="lg">
                    Continue planning
                  </HuiLinkButton>
                ) : null}
                <HuiLinkButton
                  href={`/groups/${resolved.groupId}`}
                  size="lg"
                  variant={planningPreview ? "soft" : "primary"}
                >
                  Open group
                </HuiLinkButton>
              </div>
            </div>
          ) : null}

          {resolved.status === "valid" ? (
            <>
              <JoinInvitePreview
                groupName={resolved.groupName}
                inviterDisplayName={resolved.inviterDisplayName}
                planning={planningPreview}
                timeZone={timeZone}
              />
              {user ? (
                <div className="mx-auto mt-7 max-w-sm">
                  <JoinInviteButton
                    token={token}
                    groupName={resolved.groupName}
                    hasActivePlanning={planningPreview !== null}
                    focusEventId={focusEventId}
                  />
                </div>
              ) : (
                <JoinAuthLinks
                  token={token}
                  focusEventId={focusEventId}
                  groupName={resolved.groupName}
                />
              )}
            </>
          ) : null}
        </HuiSurface>
      </main>
    </div>
  );
}
