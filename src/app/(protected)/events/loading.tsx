import { AppShell } from "@/components/app/app-shell";
import { EventsOverviewSkeleton } from "@/components/home/home-sections";

export default function EventsLoading() {
  return (
    <AppShell title="Your hui">
      <EventsOverviewSkeleton />
    </AppShell>
  );
}
