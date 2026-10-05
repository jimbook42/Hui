import { parseHomeLocationForm, type ProfileHomeLocation } from "@/domain/profile/home-location";
import { normalizeDisplayName } from "@/lib/profiles/validation";

export type PersonalSetupProfilePatch = {
  displayName?: string;
  home?: ProfileHomeLocation | null;
  completeSetup: boolean;
};

export function parsePersonalSetupFormData(formData: FormData): PersonalSetupProfilePatch {
  const completeSetup = formData.get("complete_setup") === "1";
  const displayNameRaw = formData.get("display_name");
  let displayName: string | undefined;
  if (displayNameRaw !== null && displayNameRaw !== undefined) {
    const normalized = normalizeDisplayName(String(displayNameRaw));
    if (normalized) {
      displayName = normalized;
    }
  }

  const hasHomeFields = formData.has("home_location_label");
  let home: ProfileHomeLocation | null | undefined;
  if (hasHomeFields) {
    const parsed = parseHomeLocationForm(
      formData.get("home_location_label"),
      formData.get("home_location_lat"),
      formData.get("home_location_lng"),
    );
    home = parsed.ok ? parsed.home : undefined;
  }

  return { displayName, home, completeSetup };
}
