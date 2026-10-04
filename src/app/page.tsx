import { HuiBotanical } from "@/components/hui/botanical";
import { HuiLinkButton } from "@/components/hui/hui-button";
import { HuiLogo } from "@/components/hui/hui-logo";
import { HuiWordmark } from "@/components/hui/hui-wordmark";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  }

  return (
    <div className="hui-canvas relative flex min-h-full flex-1 flex-col items-center justify-center px-6 py-16">
      <HuiBotanical />
      <main className="relative z-10 w-full max-w-lg text-center">
        <div className="hui-pop mx-auto flex h-36 w-36 items-center justify-center">
          <HuiLogo size={144} priority />
        </div>
        <h1 className="hui-rise mt-8 flex justify-center">
          <HuiWordmark height={72} priority />
        </h1>
        <p className="hui-rise-2 hui-type-supporting mx-auto mt-5 max-w-sm text-lg leading-relaxed">
          A calm place for the people you gather with. Hui proposes, coordinates and remembers
          &mdash; the group decides.
        </p>
        <div className="hui-rise-3 mx-auto mt-10 flex max-w-xs flex-col items-stretch gap-3 sm:max-w-none sm:flex-row sm:justify-center">
          <HuiLinkButton href="/sign-in" size="lg" shape="melt">
            Sign in
          </HuiLinkButton>
          <HuiLinkButton href="/sign-up" size="lg" variant="soft">
            Sign up
          </HuiLinkButton>
        </div>
      </main>
    </div>
  );
}
