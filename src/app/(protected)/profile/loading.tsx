import { AppShell } from "@/components/app/app-shell";

export default function ProfileLoading() {
  return (
    <AppShell title="Account settings" subtitle="Loading your settings…">
      <div className="space-y-6" aria-busy="true">
        <div className="hui-skeleton hui-shape-organic h-28" />
        <div className="hui-skeleton hui-shape-organic h-44" />
        <div className="hui-skeleton hui-shape-organic h-32" />
      </div>
    </AppShell>
  );
}
