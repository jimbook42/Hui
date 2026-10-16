import type { EventStatus } from "@/domain/events/types";
import { bestViewerResponseAcrossProposedCandidates } from "@/domain/events/participant-flow";
import type { AvailabilityChoice, CandidateStatus } from "@/domain/scheduling/types";

export type HomeListCandidate = {
  id: string;
  status: CandidateStatus;
};

/**
 * Viewer response for Home / Your hui lists. Multi-time proposing stays "unanswered" until
 * every proposed time has a saved answer (matches the respond flow).
 */
export function viewerResponseForHomeList(
  candidates: HomeListCandidate[],
  eventStatus: EventStatus,
  responseByCandidate: ReadonlyMap<string, AvailabilityChoice>,
): AvailabilityChoice | null {
  if (eventStatus === "confirmed") {
    const selected = candidates.find((candidate) => candidate.status === "selected");
    if (!selected) {
      return null;
    }
    return responseByCandidate.get(selected.id) ?? null;
  }

  const proposed = candidates.filter((candidate) => candidate.status === "proposed");
  if (proposed.length > 1) {
    const allAnswered = proposed.every((candidate) => responseByCandidate.has(candidate.id));
    if (!allAnswered) {
      return null;
    }
    return bestViewerResponseAcrossProposedCandidates(
      proposed.map((candidate) => ({
        id: candidate.id,
        startsAt: "",
        endsAt: "",
        status: candidate.status,
        viewerResponse: responseByCandidate.get(candidate.id) ?? null,
      })),
    );
  }

  const focus =
    candidates.find((candidate) => candidate.status === "selected") ?? proposed[0] ?? null;

  if (!focus) {
    return null;
  }
  return responseByCandidate.get(focus.id) ?? null;
}

/** Candidate ids whose viewer responses must be loaded for home classification. */
export function homeViewerResponseCandidateIds(
  candidates: HomeListCandidate[],
  eventStatus: EventStatus,
): string[] {
  const selected = candidates.find((candidate) => candidate.status === "selected");
  if (eventStatus === "confirmed") {
    return selected ? [selected.id] : [];
  }
  if (selected) {
    return [selected.id];
  }
  const proposed = candidates.filter((candidate) => candidate.status === "proposed");
  if (proposed.length > 1) {
    return proposed.map((candidate) => candidate.id);
  }
  if (proposed.length === 1) {
    return [proposed[0].id];
  }
  return [];
}
