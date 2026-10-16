import { PRIVACY_CONTACT_EMAIL } from "@/lib/legal/privacy-contact";

const mailto = `mailto:${PRIVACY_CONTACT_EMAIL}`;

export function PrivacyStatementContent() {
  return (
    <div className="space-y-8 text-sm leading-relaxed text-foreground">
      <div className="space-y-4 text-muted-foreground">
        <p>
          Hui helps groups of people plan regular gatherings: choosing a time, deciding who hosts,
          and sorting out who&apos;s bringing what. This statement explains what personal information
          Hui collects, how it is used and shared, how it is protected, and the choices and rights
          you have.
        </p>
        <p>
          Hui collects only the information it needs to run the service. Hui does not sell your
          personal information, does not show advertising, and does not use advertising or analytics
          trackers.
        </p>
      </div>

      <section>
        <h2 className="text-base font-extrabold text-foreground">1. Who operates Hui</h2>
        <p className="mt-2 text-muted-foreground">
          Hui is operated by <strong className="font-bold text-foreground">Tull Labs</strong>, the
          trading name of Isaac Tull, a sole trader based in New Zealand. Hui is available
          worldwide, and is operated under New Zealand law, including the Privacy Act 2020.
        </p>
        <p className="mt-2 text-muted-foreground">
          <strong className="font-bold text-foreground">Privacy contact:</strong>{" "}
          <a href={mailto} className="hui-link font-semibold text-foreground">
            {PRIVACY_CONTACT_EMAIL}
          </a>
        </p>
        <p className="mt-2 text-muted-foreground">
          Use this address to ask for a copy of your information, ask for a correction or deletion,
          ask a question about this statement, or raise a privacy concern.
        </p>
      </section>

      <section>
        <h2 className="text-base font-extrabold text-foreground">2. Information Hui collects</h2>

        <h3 className="mt-4 text-sm font-extrabold text-foreground">Account information</h3>
        <ul className="mt-2 list-disc space-y-2 pl-5 text-muted-foreground">
          <li>Your display name and email address.</li>
          <li>
            Your sign-in details. If you use email and password, your password is stored by our
            sign-in provider in hashed form. If you sign in with Google or Microsoft, we receive
            basic profile details from that service (such as your name, email address and, where
            provided, a profile picture link) and an identifier for your account with it.
          </li>
          <li>Your settings, such as notification preferences.</li>
        </ul>

        <h3 className="mt-4 text-sm font-extrabold text-foreground">Group and gathering information</h3>
        <p className="mt-2 text-muted-foreground">
          When you create or take part in a group or gathering, Hui stores:
        </p>
        <ul className="mt-2 list-disc space-y-2 pl-5 text-muted-foreground">
          <li>
            Group names, who is in each group, and each member&apos;s role (for example organiser or
            member).
          </li>
          <li>
            Gatherings: title, type, proposed and confirmed dates and times, place, and any notes added
            to the gathering.
          </li>
          <li>
            Your answers to proposed times (Yes, Maybe or Can&apos;t), any note you add to an answer,
            and any regular availability you save for a group.
          </li>
          <li>Hosting arrangements, including host suggestions, acceptances and swaps.</li>
          <li>Who&apos;s bringing what, including items and the names of the people bringing them.</li>
          <li>
            Records of past gatherings, such as who attended and notes about the occasion, if your
            group records them.
          </li>
          <li>
            A record of membership changes (for example when someone joins, leaves or changes role)
            and of rescheduled gatherings.
          </li>
        </ul>
        <p className="mt-2 text-muted-foreground">Hui has no chat or messaging feature.</p>

        <h3 className="mt-4 text-sm font-extrabold text-foreground">Places and your home address</h3>
        <p className="mt-2 text-muted-foreground">
          You can choose to save a home address so you can offer to host at your place. Hui stores
          the address text and its map coordinates. Gathering places are also stored with map
          coordinates so they can be shown on a map. When you search for an address, the text you
          type is sent to our address search provider (see section 5).
        </p>

        <h3 className="mt-4 text-sm font-extrabold text-foreground">Dietary information</h3>
        <p className="mt-2 text-muted-foreground">
          You can choose to add dietary requirements or food preferences, with optional notes. These
          details can reveal sensitive information, such as health conditions or religious beliefs.
          Your dietary details are private to you until you choose to share them, either with
          particular groups or with all of your groups. You can change or remove them at any time.
        </p>
        <p className="mt-2 text-muted-foreground">Please only enter what is needed to plan the food.</p>

        <h3 className="mt-4 text-sm font-extrabold text-foreground">Notifications</h3>
        <ul className="mt-2 list-disc space-y-2 pl-5 text-muted-foreground">
          <li>In-app alerts about your groups and gatherings.</li>
          <li>
            If you turn on push notifications, a push subscription for your browser or device. This
            is a web address issued by your browser&apos;s push service, encryption keys, and a
            description of your browser. We use it only to send you the alerts you have chosen.
          </li>
        </ul>

        <h3 className="mt-4 text-sm font-extrabold text-foreground">Technical information</h3>
        <p className="mt-2 text-muted-foreground">
          When you use Hui, our hosting and database providers process technical information needed
          to run, secure and troubleshoot the service, such as your IP address, browser and device
          type, the time of requests, and error details. This is held in their operational logs.
        </p>
        <p className="mt-2 text-muted-foreground">
          Hui does not use analytics, advertising or tracking tools.
        </p>

        <h3 className="mt-4 text-sm font-extrabold text-foreground">Cookies and storage on your device</h3>
        <p className="mt-2 text-muted-foreground">Hui uses only what it needs to work:</p>
        <ul className="mt-2 list-disc space-y-2 pl-5 text-muted-foreground">
          <li>
            <strong className="font-bold text-foreground">Sign-in cookies</strong> keep you signed
            in securely.
          </li>
          <li>
            <strong className="font-bold text-foreground">Storage in your browser</strong> remembers
            things like your light or dark theme, whether you&apos;ve dismissed the install or
            notification prompts, and an unfinished gathering proposal while you&apos;re working on
            it.
          </li>
        </ul>
        <p className="mt-2 text-muted-foreground">
          These are not used for advertising or cross-site tracking. Sign-in cookies are handled by
          our hosting and sign-in providers (see section 5) only to keep you signed in.
        </p>

        <h3 className="mt-4 text-sm font-extrabold text-foreground">
          Invitations and information about other people
        </h3>
        <p className="mt-2 text-muted-foreground">
          People are invited to a group with a share link. Hui does not ask for, collect or store an
          invitee&apos;s email address, phone number or other contact details, and holds nothing
          about someone until they open the link and create an account.
        </p>
        <p className="mt-2 text-muted-foreground">
          Some features let you enter information that relates to someone else, such as a name in
          &quot;Who&apos;s bringing what&quot; or a note about a past gathering. Please only enter
          what is needed to organise the gathering, and make sure the person would be comfortable
          with it. If you are named in Hui by someone else, this statement explains what is held,
          why, who can see it, and how to ask for it to be corrected or removed. Information like
          this is visible only to members of that group, and anyone can contact us at the address
          above about information that relates to them.
        </p>
      </section>

      <section>
        <h2 className="text-base font-extrabold text-foreground">3. Why Hui uses personal information</h2>
        <p className="mt-2 text-muted-foreground">Hui uses personal information to:</p>
        <ul className="mt-2 list-disc space-y-2 pl-5 text-muted-foreground">
          <li>create your account, sign you in and keep it secure;</li>
          <li>show you your groups and gatherings;</li>
          <li>work out the best times from members&apos; answers and confirm gatherings;</li>
          <li>organise hosting, places and who&apos;s bringing what;</li>
          <li>take account of dietary needs that people have chosen to share;</li>
          <li>send the in-app and push alerts you have chosen;</li>
          <li>respond to your requests and questions; and</li>
          <li>keep the service working, fix problems and prevent misuse.</li>
        </ul>
        <p className="mt-2 text-muted-foreground">
          Some information is needed for Hui to work. For example, without an email address you cannot
          create an account, and without your answers your group can&apos;t plan around you. Other
          information, such as dietary details, a home address or push notifications, is optional.
        </p>
        <p className="mt-2 text-muted-foreground">
          Hui does not use your information for advertising, does not sell it, and does not use it to
          build profiles for anyone else.
        </p>
      </section>

      <section>
        <h2 className="text-base font-extrabold text-foreground">4. Who can see your information</h2>
        <p className="mt-2 text-muted-foreground">
          Access is enforced in Hui&apos;s database, not only in the app&apos;s screens.
        </p>
        <ul className="mt-2 list-disc space-y-2 pl-5 text-muted-foreground">
          <li>
            <strong className="font-bold text-foreground">Your group</strong> can see: your display
            name; your membership and role; the gatherings in that group, including their places and
            notes; hosting arrangements; who&apos;s bringing what; and records of past gatherings.
          </li>
          <li>
            <strong className="font-bold text-foreground">Your answers</strong> to proposed times
            (Yes, Maybe or Can&apos;t) are shown to the other members of that group next to your
            name, so everyone can see who can make it. Any note you add to an answer is visible only
            to you.
          </li>
          <li>
            <strong className="font-bold text-foreground">Your regular availability</strong> is
            visible only to you. Hui combines members&apos; availability to suggest good times,
            without showing whose availability is whose.
          </li>
          <li>
            <strong className="font-bold text-foreground">Your dietary details</strong> are visible
            only to you until you share them. Once shared, members of the groups you shared them
            with can see them. If you leave a group, they are no longer visible to that group.
          </li>
          <li>
            <strong className="font-bold text-foreground">Your home address</strong> is used for
            hosting at your place. Only you can see it, except that when you host a gathering at
            home, the address is added as that gathering&apos;s place and members of that group can
            see it there. That copy stays with the gathering if you later change or remove your saved
            address. If you delete your account, the place is removed from every gathering you
            hosted, past and upcoming, whatever that place was (see section 8).
          </li>
          <li>
            <strong className="font-bold text-foreground">Organisers</strong> can also see the
            group&apos;s record of membership changes.
          </li>
          <li>
            <strong className="font-bold text-foreground">Your alerts and push subscription</strong>{" "}
            are visible only to you.
          </li>
        </ul>
        <p className="mt-2 text-muted-foreground">
          People who are not in a group cannot see its information. If you leave a group or are
          removed, you stop seeing it, and its members stop seeing your profile.
        </p>
      </section>

      <section>
        <h2 className="text-base font-extrabold text-foreground">5. Service providers and disclosures</h2>
        <p className="mt-2 text-muted-foreground">
          Hui uses these providers to run the service. They process information on Hui&apos;s behalf
          to provide their service.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[28rem] border-collapse text-left text-muted-foreground">
            <thead>
              <tr className="border-b border-border">
                <th className="py-2 pr-3 font-extrabold text-foreground">Provider</th>
                <th className="py-2 pr-3 font-extrabold text-foreground">What it does</th>
                <th className="py-2 font-extrabold text-foreground">What it handles</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              <tr className="border-b border-border/60">
                <td className="py-2 pr-3 align-top">
                  <strong className="font-bold text-foreground">Supabase</strong>
                </td>
                <td className="py-2 pr-3 align-top">Database, sign-in and sign-in emails</td>
                <td className="py-2 align-top">
                  All account, group and gathering information described above
                </td>
              </tr>
              <tr className="border-b border-border/60">
                <td className="py-2 pr-3 align-top">
                  <strong className="font-bold text-foreground">Vercel</strong>
                </td>
                <td className="py-2 pr-3 align-top">
                  Hosts the app and runs its server code and scheduled tasks
                </td>
                <td className="py-2 align-top">Requests passing through the app, and technical logs</td>
              </tr>
              <tr className="border-b border-border/60">
                <td className="py-2 pr-3 align-top">
                  <strong className="font-bold text-foreground">Google</strong> and{" "}
                  <strong className="font-bold text-foreground">Microsoft</strong>
                </td>
                <td className="py-2 pr-3 align-top">Sign-in, only if you choose it</td>
                <td className="py-2 align-top">Your sign-in with that service</td>
              </tr>
              <tr className="border-b border-border/60">
                <td className="py-2 pr-3 align-top">
                  <strong className="font-bold text-foreground">Geoapify</strong>
                </td>
                <td className="py-2 pr-3 align-top">Address search</td>
                <td className="py-2 align-top">The address text you type when searching for a place</td>
              </tr>
              <tr className="border-b border-border/60">
                <td className="py-2 pr-3 align-top">
                  <strong className="font-bold text-foreground">OpenFreeMap</strong>
                </td>
                <td className="py-2 pr-3 align-top">Map display</td>
                <td className="py-2 align-top">
                  Map requests from your browser, including your IP address and the area of the map
                  you view
                </td>
              </tr>
              <tr>
                <td className="py-2 pr-3 align-top">
                  <strong className="font-bold text-foreground">Your browser&apos;s push service</strong>{" "}
                  (for example Google, Apple or Mozilla)
                </td>
                <td className="py-2 pr-3 align-top">
                  Delivers push notifications, only if you turn them on
                </td>
                <td className="py-2 align-top">
                  Your push subscription and the notification, which is encrypted so the push service
                  can&apos;t read it
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-muted-foreground">
          Supabase processes Hui&apos;s data under its standard Data Processing Addendum, which forms
          part of its terms of service.
        </p>
        <p className="mt-2 text-muted-foreground">
          Hui may also disclose personal information if required by law, or where the Privacy Act 2020
          otherwise allows it, for example to prevent a serious threat to someone&apos;s safety.
        </p>
      </section>

      <section>
        <h2 className="text-base font-extrabold text-foreground">
          6. Where information is stored, and security
        </h2>
        <p className="mt-2 text-muted-foreground">
          Hui&apos;s database is hosted by Supabase in <strong className="font-bold text-foreground">Sydney, Australia</strong>. The app&apos;s server code runs on Vercel, also in{" "}
          <strong className="font-bold text-foreground">Sydney, Australia</strong>, and Vercel
          delivers the app through a global network, so requests may be handled in the region nearest
          to you. Sign-in, address search, maps and push providers may process information in other
          countries, including the United States.
        </p>
        <p className="mt-2 text-muted-foreground">
          This means your information is sent to and processed outside New Zealand. The providers in
          section 5 handle it on Hui&apos;s behalf to provide their service, and Hui remains
          responsible for it under the Privacy Act 2020. Hui chooses established providers that
          publish their own security and privacy commitments.
        </p>
        <p className="mt-2 text-muted-foreground">To protect your information, Hui:</p>
        <ul className="mt-2 list-disc space-y-2 pl-5 text-muted-foreground">
          <li>sends all information over encrypted connections (HTTPS);</li>
          <li>
            uses database access rules so that people can only reach information they are allowed to
            see;
          </li>
          <li>relies on its sign-in provider to handle passwords and sign-in securely; and</li>
          <li>limits administrative access to the operator.</li>
        </ul>
        <p className="mt-2 text-muted-foreground">
          No online service can be completely secure, and Hui cannot guarantee that information will
          never be accessed without permission. If you think your account has been compromised, contact
          us straight away.
        </p>
      </section>

      <section>
        <h2 className="text-base font-extrabold text-foreground">7. How long information is kept</h2>
        <p className="mt-2 text-muted-foreground">
          Hui keeps personal information only for as long as it&apos;s needed for the purposes in this
          statement, or as required by law.
        </p>
        <ul className="mt-2 list-disc space-y-2 pl-5 text-muted-foreground">
          <li>
            <strong className="font-bold text-foreground">Account information</strong> is kept while
            your account is open, and deleted or anonymised when you delete your account (see section
            8).
          </li>
          <li>
            <strong className="font-bold text-foreground">Group and gathering information</strong> is
            kept while the group exists, because it is shared with other members. It is deleted when
            the group is deleted.
          </li>
          <li>
            <strong className="font-bold text-foreground">Technical logs</strong> are kept by our
            providers for a limited period under their own retention settings.
          </li>
          <li>
            <strong className="font-bold text-foreground">Backups:</strong> if backup copies of the
            database are kept, deleted information may remain in them for a limited period until they
            are replaced or deleted. Backups are used only to restore the service, not for any other
            purpose.
          </li>
        </ul>
      </section>

      <section id="delete-your-data">
        <h2 className="text-base font-extrabold text-foreground">8. Deleting your account and groups</h2>
        <p className="mt-2 text-muted-foreground">
          <strong className="font-bold text-foreground">Deleting your account.</strong> You can delete
          your account in the app: open <strong className="font-bold text-foreground">Profile</strong>
          , go to <strong className="font-bold text-foreground">Account</strong>, and choose{" "}
          <strong className="font-bold text-foreground">Delete my account</strong>. You can also email{" "}
          <a href={mailto} className="hui-link font-semibold text-foreground">
            {PRIVACY_CONTACT_EMAIL}
          </a>{" "}
          from the address linked to your account.
        </p>
        <p className="mt-2 text-muted-foreground">
          If you organise a group that still has other members, you will need to hand the organiser
          role to someone else first.
        </p>
        <p className="mt-2 text-muted-foreground">When you delete your account, Hui:</p>
        <ul className="mt-2 list-disc space-y-2 pl-5 text-muted-foreground">
          <li>
            permanently deletes your sign-in account, including your email address and sign-in
            details;
          </li>
          <li>deletes your dietary details, push subscriptions and alerts;</li>
          <li>removes you from all your groups;</li>
          <li>deletes any group where you were the only member, with everything in it; and</li>
          <li>replaces your display name with &quot;Former member&quot;.</li>
        </ul>
        <p className="mt-2 text-muted-foreground">
          Some shared records stay with the groups you were in, because they are part of other
          members&apos; history. For example, a past gathering you created or hosted, or a record
          that you were bringing something, may remain, shown as &quot;Former member&quot;. Your
          answers on past gatherings stay in that group&apos;s history, shown as &quot;Former
          member&quot;, with any notes removed. Your answers on upcoming gatherings, your saved
          availability and your saved home address are deleted. The place is also removed from every
          gathering you hosted, past and upcoming, whatever that place was; the gathering stays for
          the group, without a place.
        </p>
        <p className="mt-2 text-muted-foreground">
          <strong className="font-bold text-foreground">Deleting a group.</strong> An organiser can
          delete a group. This permanently deletes the group and everything in it, including its
          gatherings, answers, hosting, who&apos;s bringing what, dietary sharing with that group,
          and invite links. This can&apos;t be undone.
        </p>
      </section>

      <section>
        <h2 className="text-base font-extrabold text-foreground">9. Access and correction</h2>
        <p className="mt-2 text-muted-foreground">
          Under the Privacy Act 2020, you have the right to ask for a copy of the personal information
          Hui holds about you, and to ask for it to be corrected.
        </p>
        <p className="mt-2 text-muted-foreground">
          You can view and update most of your information yourself in the app, such as your name,
          dietary details, home address and notification settings. For anything else, email{" "}
          <a href={mailto} className="hui-link font-semibold text-foreground">
            {PRIVACY_CONTACT_EMAIL}
          </a>
          . Hui will respond as soon as possible and within 20 working days, as the Privacy Act
          requires. If we need more time, as the Act allows in some cases, we&apos;ll tell you why
          and when to expect a response. We may need to confirm your identity first. If we do not
          agree to make a correction you ask for, you can ask us to attach a statement of the
          correction you wanted to your information.
        </p>
        <p className="mt-2 text-muted-foreground">These rights are available wherever you live.</p>
      </section>

      <section>
        <h2 className="text-base font-extrabold text-foreground">10. Privacy breaches</h2>
        <p className="mt-2 text-muted-foreground">
          If a privacy breach happens, Hui will act quickly to contain it and reduce any harm. If a
          breach has caused, or is likely to cause, serious harm, Hui will notify the Office of the
          Privacy Commissioner and the people affected as soon as practicable, as the Privacy Act 2020
          requires.
        </p>
      </section>

      <section>
        <h2 className="text-base font-extrabold text-foreground">11. Changes to this statement</h2>
        <p className="mt-2 text-muted-foreground">
          Hui may update this statement when the service or the law changes. The date at the top shows
          when it was last updated. If a change significantly affects how your information is handled,
          Hui will update this page and, where practical, let you know in the app.
        </p>
      </section>

      <section>
        <h2 className="text-base font-extrabold text-foreground">12. Contact and complaints</h2>
        <p className="mt-2 text-muted-foreground">
          If you have a question or concern about privacy, contact{" "}
          <a href={mailto} className="hui-link font-semibold text-foreground">
            {PRIVACY_CONTACT_EMAIL}
          </a>
          . We&apos;ll try to resolve it with you.
        </p>
        <p className="mt-2 text-muted-foreground">
          If you are not satisfied with our response, you can complain to the Office of the Privacy
          Commissioner:{" "}
          <a
            href="https://www.privacy.org.nz/"
            className="hui-link font-semibold text-foreground"
            rel="noopener noreferrer"
            target="_blank"
          >
            www.privacy.org.nz
          </a>
          . If you live outside New Zealand, you may also be able to contact your local data
          protection authority.
        </p>
      </section>
    </div>
  );
}
