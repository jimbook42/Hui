/** User-facing release notes. Only versions listed here can show a What's new banner. */
export type WhatsNewRelease = {
  version: string;
  title: string;
  bullets: string[];
};

export const WHATS_NEW_RELEASES: WhatsNewRelease[] = [
  {
    version: "0.18.16",
    title: "What\u2019s new in Hui",
    bullets: [
      "More compact hui page layout.",
      "Tap a time to see who can come.",
      "Hui asks once what your group should call you.",
      "\u201cToo many notifications?\u201d link on your alerts.",
    ],
  },
  {
    version: "0.18.17",
    title: "What\u2019s new in Hui",
    bullets: [
      "Hosts get a push when someone claims a \u201cWhat to bring\u201d item.",
      "Clearer notification settings.",
      "Clearer note about who can see future hui when you invite people.",
    ],
  },
  {
    version: "0.18.18",
    title: "What\u2019s new in Hui",
    bullets: [
      "If you\u2019ve already answered times on an open hui, you\u2019ll get one alert when the organiser adds another time.",
      "Releasing a \u201cWhat to bring\u201d claim puts the item back on the list for someone else to take.",
      "Self-claims no longer show \u201cby organiser\u201d on the label.",
    ],
  },
  {
    version: "0.18.19",
    title: "What\u2019s new in Hui",
    bullets: [
      "Gentle reminders to add Hui to your home screen or turn on notifications so you don\u2019t miss plan changes.",
      "Self-claimed \u201cWhat to bring\u201d items no longer look organiser-assigned.",
      "Behind the scenes: tighter security on how notifications are queued.",
    ],
  },
];

export function whatsNewForVersion(version: string): WhatsNewRelease | null {
  return WHATS_NEW_RELEASES.find((entry) => entry.version === version) ?? null;
}
