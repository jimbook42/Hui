import type { ReactNode } from "react";

import { HuiSurface } from "@/components/hui/hui-surface";
import { SectionHeader } from "@/components/hui/section-header";

type SettingsSectionProps = {
  title: string;
  description?: string;
  children: ReactNode;
};

export function SettingsSection({
  title,
  description,
  children,
}: SettingsSectionProps) {
  return (
    <HuiSurface elevated padding="md" className="space-y-5">
      <SectionHeader title={title} description={description} />
      <div>{children}</div>
    </HuiSurface>
  );
}
