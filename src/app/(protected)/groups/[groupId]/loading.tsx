import { AppShell } from "@/components/app/app-shell";

export default function GroupDetailLoading() {
  return (
    <AppShell title="Group" hideTitle back={{ href: "/groups", label: "Groups" }}>
      <div className="space-y-6" aria-busy="true" aria-label="Loading group">
        <div className="hui-skeleton hui-shape-organic h-56" />
        <div className="hui-skeleton h-40 !rounded-hui-xl" />
        <div className="hui-skeleton h-24 !rounded-hui-xl" />
      </div>
    </AppShell>
  );
}
