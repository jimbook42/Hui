import type { ReactNode } from "react";

import { HuiSurface } from "@/components/hui/hui-surface";
import { SectionHeader } from "@/components/hui/section-header";

type SettingsSectionProps = {
  id?: string;
  title: string;
  description?: string;
  children: ReactNode;
};

export function SettingsSection({
  id,
  title,
  description,
  children,
}: SettingsSectionProps) {
  return (
    <HuiSurface id={id} elevated padding="md" className="space-y-5 scroll-mt-24">
      <SectionHeader title={title} description={description} />
      <div>{children}</div>
    </HuiSurface>
  );
}
