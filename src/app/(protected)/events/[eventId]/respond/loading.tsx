import { AppShell } from "@/components/app/app-shell";

export default function EventRespondLoading() {
  return (
    <AppShell title="Your response">
      <div
        className="mx-auto max-w-md space-y-5 pb-8"
        aria-busy="true"
        aria-label="Loading response flow"
      >
        <div className="space-y-2">
          <div className="hui-skeleton h-4 w-1/3" />
          <div className="hui-skeleton h-7 w-4/5" />
          <div className="hui-skeleton h-4 w-1/2" />
        </div>
        <div className="hui-skeleton h-1.5 w-full rounded-full" />
        <div className="space-y-2">
          <div className="hui-skeleton h-8 w-2/3" />
          <div className="hui-skeleton h-4 w-full" />
        </div>
        <ul className="space-y-4" aria-hidden="true">
          {[0, 1, 2].map((index) => (
            <li key={index} className="rounded-hui-xl bg-surface p-4 hui-shadow-sm">
              <div className="hui-skeleton h-4 w-3/5" />
              <div className="mt-3 space-y-2">
                <div className="hui-skeleton h-[4.5rem] w-full !rounded-hui-xl" />
                <div className="hui-skeleton h-[4.5rem] w-full !rounded-hui-xl" />
                <div className="hui-skeleton h-[4.5rem] w-full !rounded-hui-xl" />
              </div>
            </li>
          ))}
        </ul>
      </div>
    </AppShell>
  );
}
