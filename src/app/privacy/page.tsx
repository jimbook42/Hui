import Link from "next/link";

import { HuiBotanical } from "@/components/hui/botanical";
import { HuiSurface } from "@/components/hui/hui-surface";
import { HuiLogo } from "@/components/hui/hui-logo";
import { HuiWordmark } from "@/components/hui/hui-wordmark";
import { PRIVACY_CONTACT_EMAIL } from "@/lib/legal/privacy-contact";

const LAST_UPDATED = "15 October 2026";

export default function PrivacyPage() {
  return (
    <div className="hui-canvas relative flex min-h-full flex-1 flex-col px-5 py-10">
      <HuiBotanical />
      <main className="relative z-10 mx-auto w-full max-w-2xl">
        <Link
          href="/"
          aria-label="Hui home"
          className="hui-focus-ring mx-auto mb-8 flex w-fit flex-col items-center gap-2 rounded-hui-lg p-1"
        >
          <HuiLogo size={48} />
          <HuiWordmark height={28} />
        </Link>

        <h1 className="hui-type-display text-center text-foreground">Privacy policy</h1>
        <p className="hui-type-supporting mt-2 text-center">
          Last updated: {LAST_UPDATED}
        </p>

        <HuiSurface shape="organic" padding="lg" elevated className="hui-rise mt-8 space-y-8 text-sm leading-relaxed text-foreground">
          <section>
            <h2 className="text-base font-extrabold text-foreground">Who we are</h2>
            <p className="mt-2 text-muted-foreground">
              Hui is a privacy-first app for planning recurring gatherings with the people you
              care about. It is built by Isaac Tull in New Zealand. This policy explains how we
              handle your personal information when you use Hui.
            </p>
          </section>

          <section>
            <h2 className="text-base font-extrabold text-foreground">What we collect</h2>
            <p className="mt-2 text-muted-foreground">
              We collect only what we need to run Hui for you and your groups:
            </p>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-muted-foreground">
              <li>Your display name and email address</li>
              <li>Your sign-in provider identifier when you use Google, Microsoft, or Facebook</li>
              <li>Your membership in Hui groups and your role in each group</li>
              <li>Your availability answers for planning (including standing preferences you save)</li>
              <li>Dietary information you choose to share with a group</li>
              <li>A saved home address if you add one for hosting at your place</li>
              <li>Push notification subscription details if you turn on web push alerts</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-extrabold text-foreground">Why we collect it</h2>
            <p className="mt-2 text-muted-foreground">
              We use this information to create and secure your account, show you the right
              groups and events, coordinate dates with your group, respect dietary and hosting
              preferences, send notifications you have asked for, and improve reliability of the
              service. We do not use your data for advertising and we do not sell your personal
              information.
            </p>
          </section>

          <section>
            <h2 className="text-base font-extrabold text-foreground">Who we share it with</h2>
            <p className="mt-2 text-muted-foreground">
              We share data only with service providers that help us run Hui, under contracts that
              limit how they may use it:
            </p>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-muted-foreground">
              <li>
                <strong className="font-bold text-foreground">Supabase</strong> — database and
                authentication
              </li>
              <li>
                <strong className="font-bold text-foreground">Vercel</strong> — hosting and delivery
                of the app
              </li>
              <li>
                <strong className="font-bold text-foreground">Geoapify and OpenStreetMap</strong> —
                address search when you look up a location
              </li>
              <li>
                <strong className="font-bold text-foreground">Google, Microsoft, and Facebook</strong> —
                sign-in only, when you choose that option
              </li>
            </ul>
            <p className="mt-3 text-muted-foreground">
              Other members of your groups see coordination information according to Hui&apos;s
              privacy rules (for example, derived availability, not raw private notes you did not
              share). We may disclose information if required by law.
            </p>
          </section>

          <section>
            <h2 className="text-base font-extrabold text-foreground">How long we keep it</h2>
            <p className="mt-2 text-muted-foreground">
              We keep your account data while your account is active. When you delete your account,
              we remove or anonymise your personal data in line with our deletion process, except
              where we must retain a minimal record for security, legal compliance, or backup
              cycles that are already in progress.
            </p>
          </section>

          <section>
            <h2 className="text-base font-extrabold text-foreground">Your rights (New Zealand)</h2>
            <p className="mt-2 text-muted-foreground">
              Under the Privacy Act 2020 (New Zealand), you have rights to access and correct your
              personal information, and to complain to the Office of the Privacy Commissioner if you
              believe we have handled your information wrongly. Contact us using the details below
              and we will respond within a reasonable time.
            </p>
          </section>

          <section id="delete-your-data">
            <h2 className="text-base font-extrabold text-foreground">Delete your data</h2>
            <p className="mt-2 text-muted-foreground">
              You can delete your Hui account and associated personal data at any time:
            </p>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-muted-foreground">
              <li>
                In the app: open <strong className="font-bold text-foreground">Profile</strong>,
                go to <strong className="font-bold text-foreground">Account</strong>, and use{" "}
                <strong className="font-bold text-foreground">Delete my account</strong>.
              </li>
              <li>
                By email: write to{" "}
                <a
                  href={`mailto:${PRIVACY_CONTACT_EMAIL}`}
                  className="hui-link font-semibold text-foreground"
                >
                  {PRIVACY_CONTACT_EMAIL}
                </a>{" "}
                from the address linked to your account and ask us to delete it.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-extrabold text-foreground">Contact</h2>
            <p className="mt-2 text-muted-foreground">
              Questions about this policy or your personal information:{" "}
              <a
                href={`mailto:${PRIVACY_CONTACT_EMAIL}`}
                className="hui-link font-semibold text-foreground"
              >
                {PRIVACY_CONTACT_EMAIL}
              </a>
            </p>
          </section>
        </HuiSurface>

        <p className="mt-6 text-center text-sm">
          <Link
            href="/sign-in"
            className="hui-focus-ring inline-flex min-h-11 items-center rounded-full px-4 font-bold text-muted-foreground hover:text-foreground"
          >
            Back to sign in
          </Link>
        </p>
      </main>
    </div>
  );
}
