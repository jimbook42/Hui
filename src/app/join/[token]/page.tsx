import { HuiBotanical } from "@/components/hui/botanical";
import { HuiLinkButton } from "@/components/hui/hui-button";
import { HuiSurface } from "@/components/hui/hui-surface";
import { HuiLogo } from "@/components/hui/hui-logo";
import { HuiWordmark } from "@/components/hui/hui-wordmark";
import { JoinAuthLinks, JoinInviteButton } from "@/components/join/join-invite-actions";
import { parseInviteResolvePayload } from "@/domain/invites/resolve";
import { createClient } from "@/lib/supabase/server";

type PageProps = {
  params: Promise<{ token: string }>;
};

export default async function JoinInvitePage({ params }: PageProps) {
  const { token } = await params;
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("resolve_group_invite", {
    p_token: token,
  });

  const resolved = error ? { status: "invalid" as const } : parseInviteResolvePayload(data);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="hui-canvas relative flex min-h-dvh flex-col items-center justify-center px-5 py-12">
      <HuiBotanical />
      <main className="relative z-10 w-full max-w-md">
        <div className="mx-auto mb-7 flex w-fit flex-col items-center gap-2">
          <HuiLogo size={64} priority />
          <HuiWordmark height={36} priority />
        </div>
        <HuiSurface shape="organic" padding="lg" elevated className="hui-rise text-center">
          {resolved.status === "invalid" ? (
            <>
              <h1 className="hui-type-page-title text-foreground">Invite not valid</h1>
              <p className="hui-type-supporting mt-3">This invite link is no longer valid.</p>
              <div className="mt-7 flex justify-center">
                <HuiLinkButton href={user ? "/dashboard" : "/sign-in"} variant="soft">
                  {user ? "Back to dashboard" : "Sign in to Hui"}
                </HuiLinkButton>
              </div>
            </>
          ) : null}

          {resolved.status === "already_member" ? (
            <>
              <h1 className="hui-type-page-title text-foreground">Already a member</h1>
              <p className="hui-type-supporting mt-3">
                You&apos;re already a member of{" "}
                <span className="font-extrabold text-foreground">{resolved.groupName}</span>.
              </p>
              <div className="mt-7 flex justify-center">
                <HuiLinkButton href={`/groups/${resolved.groupId}`} size="lg">
                  Open Hui
                </HuiLinkButton>
              </div>
            </>
          ) : null}

          {resolved.status === "valid" ? (
            <>
              <h1 className="hui-type-page-title text-foreground">You&apos;re invited</h1>
              <p className="hui-type-supporting mt-3">
                You&apos;re invited to join{" "}
                <span className="font-extrabold text-foreground">{resolved.groupName}</span>.
              </p>
              {user ? (
                <div className="mx-auto mt-7 max-w-sm">
                  <JoinInviteButton token={token} />
                </div>
              ) : (
                <JoinAuthLinks token={token} />
              )}
            </>
          ) : null}
        </HuiSurface>
      </main>
    </div>
  );
}
