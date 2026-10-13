import { ProfileSectionShell } from "@/components/profile/profile-hub-link";
import { SettingsSection } from "@/components/profile/settings-section";
import { ThemeToggle } from "@/components/profile/theme-toggle";

export default function ProfileAppearancePage() {
  return (
    <ProfileSectionShell title="Appearance" description="Choose how Hui looks on this device.">
      <SettingsSection title="Theme" description="Light, dark, or follow your system setting.">
        <ThemeToggle />
      </SettingsSection>
    </ProfileSectionShell>
  );
}
