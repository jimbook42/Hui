import type { ReactNode } from "react";

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
    <section
      className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
    >
      <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
        {title}
      </h2>
      {description ? (
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          {description}
        </p>
      ) : null}
      <div className="mt-5">{children}</div>
    </section>
  );
}
