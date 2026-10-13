import { AppShell } from "@/components/app/app-shell";

export default function EventRespondLoading() {
  return (
    <AppShell title="Your response">
      <div
        className="mx-auto max-w-md space-y-4 pb-8"
        aria-busy="true"
        aria-label="Loading response flow"
      >
        <div className="hui-skeleton h-4 w-2/3" />
        <div className="hui-skeleton h-7 w-full" />
        <div className="hui-skeleton h-4 w-1/2" />
        <p className="text-base font-medium text-foreground">
          Can you make this time?
        </p>
        <div className="space-y-2">
          <div className="hui-skeleton h-12 w-full" />
          <div className="hui-skeleton h-12 w-full" />
          <div className="hui-skeleton h-12 w-full" />
        </div>
      </div>
    </AppShell>
  );
}
