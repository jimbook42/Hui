import Link from "next/link";
import { notFound } from "next/navigation";

import { AppShell } from "@/components/app/app-shell";
import { GroupInviteFriendsButton } from "@/components/groups/group-invite-friends-button";
import { HuiSurface } from "@/components/hui/hui-surface";
import { HUI_ONE_LINE_EXPLAINER } from "@/domain/events/hui-explainer";
import { resolveAuthRedirectOrigin } from "@/lib/auth/app-origin";
import { getGroupDetail } from "@/lib/groups/queries";
import { createClient } from "@/lib/supabase/server";

type PageProps = {
  params: Promise<{ groupId: string }>;
};

export default async function GroupWelcomePage({ params }: PageProps) {
  const { groupId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const detail = await getGroupDetail(supabase, groupId, user!.id);
  if (!detail) {
    notFound();
  }

  const { data: token, error } = await supabase.rpc("get_group_invite_link", {
    p_group_id: groupId,
  });
  if (error || typeof token !== "string") {
    notFound();
  }

  const appOrigin = await resolveAuthRedirectOrigin();

  return (
    <AppShell
      title={detail.name}
      subtitle="Your group is ready."
      back={{ href: "/groups", label: "Groups" }}
      narrow
    >
      <HuiSurface padding="lg" shape="organic" elevated className="space-y-6">
        <p className="text-sm font-semibold text-muted-foreground">{HUI_ONE_LINE_EXPLAINER}</p>
        <GroupInviteFriendsButton
          groupName={detail.name}
          inviteToken={token}
          appOrigin={appOrigin}
        />
        <Link
          href={`/groups/${groupId}/events/new`}
          className="hui-focus-ring block min-h-12 rounded-full border-2 border-border bg-surface px-6 py-3 text-center text-sm font-extrabold text-foreground"
        >
          Plan your first gathering
        </Link>
      </HuiSurface>
    </AppShell>
  );
}
