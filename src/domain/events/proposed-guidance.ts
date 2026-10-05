import type { EventStatus } from "@/domain/events/types";
import type { AvailabilityChoice } from "@/domain/scheduling/types";

export type ProposedHuiGuidanceInput = {
  status: EventStatus;
  isProposer: boolean;
  canRespond: boolean;
  viewerResponse: AvailabilityChoice | null;
  hasCandidate: boolean;
  canFinalise: boolean;
  anyCandidatePassesConsensus: boolean;
};

export type ProposedHuiGuidance = {
  show: boolean;
  headline: string;
  summary: string;
  steps: string[];
  nextStepTitle: string | null;
  nextStepDetail: string | null;
};

export function buildProposedHuiGuidance(
  input: ProposedHuiGuidanceInput,
  options?: { justProposed?: boolean },
): ProposedHuiGuidance {
  const empty: ProposedHuiGuidance = {
    show: false,
    headline: "",
    summary: "",
    steps: [],
    nextStepTitle: null,
    nextStepDetail: null,
  };

  if (input.status !== "proposing") {
    return empty;
  }

  if (!options?.justProposed && !input.isProposer) {
    return empty;
  }

  const steps = [
    "Everyone responds with whether they can attend.",
    "Hui uses those responses to see if a proposed time meets the group's rules.",
    input.canFinalise
      ? "When the rules are satisfied, you can confirm the hui."
      : "When the rules are satisfied, someone who can manage the hui can confirm it.",
  ];

  let nextStepTitle: string | null = null;
  let nextStepDetail: string | null = null;

  if (input.isProposer && input.canRespond && input.hasCandidate && input.viewerResponse === null) {
    nextStepTitle = "Your next step";
    nextStepDetail = "Add your availability too — then Hui can wait for the rest of the group.";
  } else if (input.isProposer && input.viewerResponse !== null) {
    nextStepTitle = "Waiting on the group";
    nextStepDetail = input.anyCandidatePassesConsensus
      ? "You've responded. Confirm the hui when everyone required has weighed in."
      : "You've responded. Hui will show when a time works for enough people.";
  } else if (!input.isProposer && input.canRespond && input.viewerResponse === null) {
    nextStepTitle = "Your next step";
    nextStepDetail = "Tell the group if you can make the proposed time.";
  }

  return {
    show: true,
    headline: options?.justProposed ? "Hui proposed" : "Planning this hui",
    summary: options?.justProposed
      ? "Your hui has been shared with the group."
      : "This hui is waiting on responses before it can be confirmed.",
    steps,
    nextStepTitle,
    nextStepDetail,
  };
}
