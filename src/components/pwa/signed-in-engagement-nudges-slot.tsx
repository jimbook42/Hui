import { SignedInEngagementNudges } from "@/components/pwa/signed-in-engagement-nudges";
import { getVapidPublicKey } from "@/lib/push/config";

export function SignedInEngagementNudgesSlot() {
  const vapidPublicKey = getVapidPublicKey();
  const pushConfigured = vapidPublicKey !== null;
  return (
    <SignedInEngagementNudges pushConfigured={pushConfigured} vapidPublicKey={vapidPublicKey} />
  );
}
