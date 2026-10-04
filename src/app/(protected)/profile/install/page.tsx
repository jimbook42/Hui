import { InstallHuiSettings } from "@/components/pwa/install-hui";
import { ProfileSectionShell } from "@/components/profile/profile-hub-link";
import { SettingsSection } from "@/components/profile/settings-section";

export default function ProfileInstallPage() {
  return (
    <ProfileSectionShell
      title="Install Hui"
      description="Hui works as an app on your phone or computer. No app store needed."
    >
      <SettingsSection title="Add to home screen" description="Install instructions for your device.">
        <InstallHuiSettings />
      </SettingsSection>
    </ProfileSectionShell>
  );
}
