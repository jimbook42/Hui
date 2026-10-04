import { EmptyState } from "@/components/hui/empty-state";
import { HuiBotanical } from "@/components/hui/botanical";

export default function OfflinePage() {
  return (
    <div className="hui-canvas relative flex min-h-full flex-1 flex-col items-center justify-center px-6 py-16">
      <HuiBotanical />
      <main className="relative z-10 w-full max-w-md">
        <h1 className="sr-only">You are offline</h1>
        <EmptyState
          title="You are offline"
          description="Hui needs a network connection for group and event data. Reconnect and you will be right back where you left off."
        />
      </main>
    </div>
  );
}
