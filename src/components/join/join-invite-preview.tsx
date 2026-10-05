import { HuiSurface } from "@/components/hui/hui-surface";
import {
  inviteHeadline,
  invitePrimaryCtaLabel,
  inviteSupportingLines,
  INVITE_WHAT_IS_HUI,
  type InvitePlanningPreview,
} from "@/domain/invites/presentation";

type JoinInvitePreviewProps = {
  groupName: string;
  inviterDisplayName: string | null;
  planning: InvitePlanningPreview | null;
  timeZone: string;
};

export function JoinInvitePreview({
  groupName,
  inviterDisplayName,
  planning,
  timeZone,
}: JoinInvitePreviewProps) {
  const headline = inviteHeadline({
    groupName,
    inviterDisplayName,
    planning,
    timeZone,
  });
  const supporting = inviteSupportingLines({
    groupName,
    inviterDisplayName,
    planning,
    timeZone,
  });
  const ctaHint = invitePrimaryCtaLabel(groupName, planning !== null);

  return (
    <div className="space-y-5 text-left">
      <h1 className="hui-type-page-title text-center text-foreground">You&apos;re invited</h1>
      <p className="hui-type-supporting text-center">{headline}</p>
      <ul className="space-y-2 text-sm font-semibold text-muted-foreground">
        {supporting.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <HuiSurface tone="subtle" padding="md" shape="soft" className="text-left">
        <p className="text-sm font-extrabold text-foreground">{INVITE_WHAT_IS_HUI.title}</p>
        <p className="mt-2 text-sm font-semibold text-muted-foreground">
          {INVITE_WHAT_IS_HUI.body}
        </p>
      </HuiSurface>
      <p className="text-center text-xs font-semibold text-muted-foreground" aria-hidden="true">
        {ctaHint}
      </p>
    </div>
  );
}
