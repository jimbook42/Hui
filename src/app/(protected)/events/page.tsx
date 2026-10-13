import { Suspense } from "react";

import { AppShell } from "@/components/app/app-shell";
import { EventsOverview, EventsOverviewSkeleton } from "@/components/home/home-sections";

export default function EventsPage() {
  return (
    <AppShell
      title="Your hui"
      subtitle="Every gathering across your groups — what needs you, what is coming up, and what is still being planned."
    >
      <Suspense fallback={<EventsOverviewSkeleton />}>
        <EventsOverview />
      </Suspense>
    </AppShell>
  );
}
