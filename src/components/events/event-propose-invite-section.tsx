import { GroupInviteSection } from "@/components/groups/group-invite-section";
import { HuiSurface } from "@/components/hui/hui-surface";
import { gatheringEventTitleForInvite, parseGatheringType } from "@/domain/gathering/type";
import { inviteHeadline } from "@/domain/invites/presentation";
import { resolveAuthRedirectOrigin } from "@/lib/auth/app-origin";
import type { EventDetail } from "@/lib/events/types";
import { createClient } from "@/lib/supabase/server";

type EventProposeInviteSectionProps = {
  detail: EventDetail;
  inviterDisplayName: string;
  gatheringType: string | null;
  gatheringTypeCustom: string | null;
  planningTargetDate: string | null;
  timeZone: string;
  prominent?: boolean;
};

export async function EventProposeInviteSection({
  detail,
  inviterDisplayName,
  gatheringType,
  gatheringTypeCustom,
  planningTargetDate,
  timeZone,
  prominent = false,
}: EventProposeInviteSectionProps) {
  const supabase = await createClient();
  const appOrigin = await resolveAuthRedirectOrigin();

  const { data: token, error } = await supabase.rpc("get_group_invite_link", {
    p_group_id: detail.groupId,
  });

  if (error || typeof token !== "string") {
    return null;
  }

  const parsedType = parseGatheringType(gatheringType);
  const inviteEventTitle = parsedType
    ? gatheringEventTitleForInvite(detail.title, parsedType, gatheringTypeCustom)
    : null;

  const previewHeadline =
    parsedType !== null
      ? inviteHeadline({
          groupName: detail.groupName,
          inviterDisplayName,
          planning: {
            eventId: detail.id,
            eventTitle: detail.title,
            status: detail.status,
            planningTargetDate,
            proposedStartsAt: detail.startsAt,
            gathering: {
              type: parsedType,
              customDescription: gatheringTypeCustom,
              eventTitle: inviteEventTitle,
            },
          },
          timeZone,
        })
      : null;

  return (
    <HuiSurface
      tone={prominent ? "default" : "subtle"}
      padding="md"
      shape="soft"
      className={prominent ? "hui-rise-2 ring-2 ring-primary/30" : "hui-rise"}
    >
      <GroupInviteSection
        groupId={detail.groupId}
        groupName={detail.groupName}
        inviteToken={token}
        appOrigin={appOrigin}
        variant="planning"
        invitePreviewHeadline={previewHeadline}
        focusEventId={detail.id}
      />
    </HuiSurface>
  );
}
