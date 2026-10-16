"use client";

import Link from "next/link";
import { useActionState, useEffect, useMemo, useRef, useState } from "react";

import type { EventActionState } from "@/app/events/actions";
import { proposeGroupEventAction } from "@/app/events/proposal-actions";
import {
  WallClockDateField,
  WallClockTimeField,
} from "@/components/events/wall-clock-picker-field";
import { ChevronDownIcon, CheckIcon } from "@/components/hui/icons";
import { EventLocationFields } from "@/components/map/event-location-fields";
import { HuiSwitchField } from "@/components/hui/hui-switch";
import { PendingButton } from "@/components/ui/pending-button";
import type { EventFoodInvolvement } from "@/domain/events/food";
import { HUI_ONE_LINE_EXPLAINER } from "@/domain/events/hui-explainer";
import {
  formatCompactEventTimeRange,
  formatDateTimeLocalInTimeZone,
  wallClockToUtcIso,
} from "@/domain/datetime/timezone";
import { proposalReplyByPreviewLabel } from "@/domain/scheduling/response-deadline";
import type { EventProposalDraft } from "@/domain/events/proposal";
import { mergeWallClockIntoCandidates, parseWallClockCandidate } from "@/domain/events/proposal";
import {
  buildInitialProposalDraft,
  fillRecurringPlanningDates,
  groupHasEstablishedRecurrence,
  initialCandidateDateFromDraft,
} from "@/domain/events/proposal-defaults";
import { buildProposingPastDateWarning } from "@/domain/events/proposal-past-warning";
import { validateCandidateStartNotPast } from "@/domain/scheduling/candidate-start-past";
import { applyMeetFrequencyToDraft } from "@/domain/events/proposal-draft-meet-frequency";
import { resolveProposalFlowStateFromClient } from "@/domain/events/proposal-draft-restore";
import {
  clearStoredProposalDraft,
  type StoredMeetFrequency,
  writeStoredProposalCadence,
  writeStoredProposalDraft,
} from "@/domain/events/proposal-draft-storage";
import { EventConfirmRuleField } from "@/components/events/event-confirm-rule-field";
import { ProposalPastDateWarning } from "@/components/events/proposal-past-date-warning";
import { GATHERING_TYPES, gatheringTypeLabel, type GatheringType } from "@/domain/gathering/type";
import {
  cadencePresetFromParts,
  FIRST_GROUP_CADENCE_PRESETS,
} from "@/domain/recurrence/cadence-presets";
import {
  formatCadenceLabel,
  pickOpenCycleNominalDate,
  type GroupPlanningCycle,
  type RecurrenceCadence,
} from "@/domain/recurrence/planning-cycle";
import { cadenceFromGroupSettings, todayDateOnlyInTimeZone } from "@/lib/groups/planning-cycle";
import type { TimeRecommendation } from "@/domain/scheduling/time-recommendations";
import { ProposalContributionRequestFields } from "@/components/events/proposal-contribution-request-fields";
import { SuggestedTimesList } from "@/components/events/suggested-times-list";
import type { ContributionCategoryRow } from "@/lib/contributions/types";
import type { GroupSettingsRow } from "@/lib/groups/types";
import { formatNominalPlanningDate } from "@/lib/groups/planning-cycle";
import { cn } from "@/lib/ui/cn";
import { useScrollTopOnStepChange } from "@/lib/ui/use-scroll-top-on-step-change";

/**
 * Three calm steps. Place, notes and contributions are optional extras (HUI-026U): the place and
 * notes live under the name step, and the contribution categories are summarised in review.
 */
const STEPS = ["name", "time", "review"] as const;
type Step = (typeof STEPS)[number];

const stepLabels: Record<Step, string> = {
  name: "Name",
  time: "Time",
  review: "Review",
};

type CreateEventProposalFlowProps = {
  groupId: string;
  groupName: string;
  settings: GroupSettingsRow;
  isFirstGroupEvent: boolean;
  contributionCategories: ContributionCategoryRow[];
  planningCycle: GroupPlanningCycle | null;
  timeRecommendations: TimeRecommendation[];
  canManageRecurrence?: boolean;
};

const initialActionState: EventActionState = {};

function hostSummary(draft: EventProposalDraft, hostingEnabled: boolean): string {
  if (!hostingEnabled) {
    return "Hosting is off for this group.";
  }
  if (draft.organiserWillHost) {
    return "You — confirmed host for this hui.";
  }
  return "No host yet — someone can accept a host proposal later.";
}

export function CreateEventProposalFlow({
  groupId,
  groupName,
  settings,
  isFirstGroupEvent,
  contributionCategories,
  planningCycle,
  timeRecommendations,
  canManageRecurrence = false,
}: CreateEventProposalFlowProps) {
  const todayDateOnly = useMemo(
    () => todayDateOnlyInTimeZone(settings.timezone),
    [settings.timezone],
  );
  const initialDraft = useMemo(
    () =>
      buildInitialProposalDraft(settings, {
        groupName,
        cycle: planningCycle,
        isFirstGroupEvent,
        todayDateOnly,
      }),
    [settings, groupName, planningCycle, isFirstGroupEvent, todayDateOnly],
  );
  const initialDate = useMemo(
    () => initialCandidateDateFromDraft(initialDraft, planningCycle),
    [initialDraft, planningCycle],
  );
  const [step, setStep] = useState<Step>("name");
  const [draft, setDraft] = useState<EventProposalDraft>(initialDraft);
  const [draftRestoredFromClient, setDraftRestoredFromClient] = useState(false);
  const restoreAppliedRef = useRef(false);

  useEffect(() => {
    if (
      !isFirstGroupEvent ||
      groupHasEstablishedRecurrence(settings, { isFirstGroupEvent }) ||
      draft.eventKind !== "recurring" ||
      !draft.recurrence
    ) {
      return;
    }
    writeStoredProposalCadence(groupId, {
      intervalUnit: draft.recurrence.intervalUnit,
      intervalCount: draft.recurrence.intervalCount,
    });
  }, [
    groupId,
    isFirstGroupEvent,
    settings,
    draft.eventKind,
    draft.recurrence?.intervalUnit,
    draft.recurrence?.intervalCount,
    draft.recurrence,
  ]);

  const [stepError, setStepError] = useState<string | null>(null);
  const [timeDate, setTimeDate] = useState(initialDate);

  function dateOnlyFromIso(iso: string, zone: string): string {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: zone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(iso));
  }

  const [timeStart, setTimeStart] = useState("12:00");
  // The end time is optional: an empty value means "start only".
  const [timeEnd, setTimeEnd] = useState("");
  const [timeAddedMessage, setTimeAddedMessage] = useState<string | null>(null);
  const [replyDeadlineLocal, setReplyDeadlineLocal] = useState("");

  const establishedRecurrence = groupHasEstablishedRecurrence(settings, { isFirstGroupEvent });
  const establishedCadence: RecurrenceCadence | null = !establishedRecurrence
    ? null
    : cadenceFromGroupSettings(settings) ?? planningCycle?.cadence ?? null;
  const [meetFrequency, setMeetFrequency] = useState<StoredMeetFrequency>(null);

  useEffect(() => {
    if (restoreAppliedRef.current) {
      return;
    }
    restoreAppliedRef.current = true;
    const resolved = resolveProposalFlowStateFromClient({
      groupId,
      settings,
      groupName,
      planningCycle,
      isFirstGroupEvent,
      todayDateOnly,
    });
    setStep(resolved.step);
    setDraft(resolved.draft);
    setTimeDate(resolved.timeDate);
    setTimeStart(resolved.timeStart);
    setTimeEnd(resolved.timeEnd);
    setMeetFrequency(resolved.meetFrequency);
    setDraftRestoredFromClient(true);
  }, [
    groupId,
    settings,
    groupName,
    planningCycle,
    isFirstGroupEvent,
    todayDateOnly,
  ]);

  useEffect(() => {
    if (!draftRestoredFromClient) {
      return;
    }
    writeStoredProposalDraft(groupId, {
      step,
      draft,
      timeDate,
      timeStart,
      timeEnd,
      meetFrequency,
    });
  }, [
    groupId,
    step,
    draft,
    timeDate,
    timeStart,
    timeEnd,
    meetFrequency,
    draftRestoredFromClient,
  ]);

  function selectMeetFrequency(next: StoredMeetFrequency) {
    setMeetFrequency(next);
    if (next === "custom") {
      setDraft((current) =>
        applyMeetFrequencyToDraft(
          {
            ...current,
            eventKind: "recurring",
            recurrence: {
              ...(current.recurrence ?? {
                seriesTitle: "",
                intervalUnit: "week",
                intervalCount: 5,
                startsOn: "",
                planningTargetDate: null,
              }),
            },
          },
          "custom",
          { groupName },
        ),
      );
      return;
    }
    setDraft((current) => applyMeetFrequencyToDraft(current, next, { groupName }));
  }

  function selectEstablishedPlanningKind(kind: "one_off" | "recurring") {
    if (kind === "one_off") {
      selectMeetFrequency("once");
      return;
    }
    const presetId =
      establishedCadence
        ? cadencePresetFromParts(
            establishedCadence.intervalUnit,
            establishedCadence.intervalCount,
          )
        : "monthly";
    selectMeetFrequency(presetId ?? "monthly");
    setDraft((current) => {
      const next = fillRecurringPlanningDates(
        applyMeetFrequencyToDraft(current, presetId ?? "monthly", { groupName }),
      );
      if (next.eventKind !== "recurring" || !next.recurrence) {
        return next;
      }
      const cycleTarget = planningCycle ? pickOpenCycleNominalDate(planningCycle) : null;
      if (!cycleTarget) {
        return next;
      }
      return fillRecurringPlanningDates({
        ...next,
        recurrence: {
          ...next.recurrence,
          planningTargetDate: next.recurrence.planningTargetDate ?? cycleTarget,
          startsOn: next.recurrence.startsOn?.trim() ? next.recurrence.startsOn : cycleTarget,
        },
      });
    });
  }

  const [actionState, formAction] = useActionState(
    proposeGroupEventAction,
    initialActionState,
  );

  const stepIndex = STEPS.indexOf(step);
  useScrollTopOnStepChange(step, { enabled: draftRestoredFromClient });
  const activeCategories = useMemo(
    () => contributionCategories.filter((row) => !row.archivedAt),
    [contributionCategories],
  );

  function goTo(next: Step) {
    setStepError(null);
    setStep(next);
  }

  function goNext() {
    setStepError(null);
    if (step === "name") {
      if (!draft.gatheringType) {
        setStepError("Choose what you are planning.");
        return;
      }
      if (
        draft.gatheringType === "other" &&
        !draft.gatheringTypeCustom.trim()
      ) {
        setStepError("Describe what you are planning.");
        return;
      }
      if ((canOneOff || canRecurring) && !establishedRecurrence) {
        if (!meetFrequency) {
          setStepError("Choose how often this group meets.");
          return;
        }
        if (meetFrequency === "once") {
          if (!canOneOff) {
            setStepError("This group only allows recurring gatherings.");
            return;
          }
        } else {
          if (!canRecurring) {
            setStepError("This group only allows one-off gatherings.");
            return;
          }
          if (meetFrequency === "custom") {
            const count = draft.recurrence?.intervalCount ?? 0;
            const unit = draft.recurrence?.intervalUnit;
            if (count < 1 || count > 52 || (unit !== "week" && unit !== "month")) {
              setStepError("Enter how often you meet — every 1 to 52 weeks or months.");
              return;
            }
          } else {
            const preset = FIRST_GROUP_CADENCE_PRESETS.find((row) => row.id === meetFrequency);
            if (!preset) {
              setStepError("Choose how often this group meets.");
              return;
            }
          }
        }
        setDraft((current) =>
          applyMeetFrequencyToDraft(current, meetFrequency, { groupName }),
        );
      }
      if (draft.eventKind === "recurring" && draft.recurrence?.planningTargetDate) {
        setTimeDate(draft.recurrence.planningTargetDate);
      }
      goTo("time");
      return;
    }
    if (step === "time") {
      if (pastDateWarning) {
        setStepError(pastDateWarning.detail.split(".")[0] ?? pastDateWarning.title);
        return;
      }
      const parsed = parseWallClockCandidate(
        timeDate,
        timeStart,
        timeEnd,
        settings.timezone,
      );
      if (!parsed && draft.candidates.length < 1) {
        setStepError(
          timeEnd.trim()
            ? "Enter a valid date and times. The end must be after the start."
            : "Enter a valid date and start time.",
        );
        return;
      }
      const merged = mergeWallClockIntoCandidates(draft.candidates, parsed);
      if (merged.error) {
        setStepError(merged.error);
        return;
      }
      if (merged.candidates.length < 1) {
        setStepError("Add at least one proposed time.");
        return;
      }
      const nowIso = new Date().toISOString();
      for (const candidate of merged.candidates) {
        const pastError = validateCandidateStartNotPast(candidate.startsAt, nowIso);
        if (pastError) {
          setStepError(pastError);
          return;
        }
      }
      setDraft((current) => {
        let next = { ...current, candidates: merged.candidates };
        if (
          next.eventKind === "recurring" &&
          merged.candidates[0] &&
          !next.recurrence?.planningTargetDate?.trim()
        ) {
          const nominal = dateOnlyFromIso(merged.candidates[0].startsAt, settings.timezone);
          next = {
            ...next,
            recurrence: {
              ...(next.recurrence ?? {
                seriesTitle: "",
                intervalUnit: "month",
                intervalCount: 1,
                startsOn: "",
                planningTargetDate: null,
              }),
              startsOn: nominal,
              planningTargetDate: nominal,
            },
          };
        }
        return next;
      });
      goTo("review");
    }
  }

  function goBack() {
    setStepError(null);
    const prev = STEPS[stepIndex - 1];
    if (prev) {
      setStep(prev);
    }
  }

  function addCandidate() {
    setStepError(null);
    const parsed = parseWallClockCandidate(
      timeDate,
      timeStart,
      timeEnd,
      settings.timezone,
    );
    if (!parsed) {
      setStepError(
        timeEnd.trim()
          ? "Enter a valid date and times. The end must be after the start."
          : "Enter a valid date and start time.",
      );
      return;
    }
    const pastError = validateCandidateStartNotPast(parsed.startsAt, new Date().toISOString());
    if (pastError) {
      setStepError(pastError);
      return;
    }
    const merged = mergeWallClockIntoCandidates(draft.candidates, parsed);
    if (merged.candidates.length === draft.candidates.length) {
      setStepError("That time is already in your proposal.");
      return;
    }
    setDraft((current) => ({
      ...current,
      candidates: merged.candidates,
    }));
    setTimeAddedMessage(
      `Added ${formatCompactEventTimeRange(parsed.startsAt, parsed.endsAt, settings.timezone)}.`,
    );
    setTimeDate("");
    setTimeStart("12:00");
    setTimeEnd("");
  }

  function removeCandidate(index: number) {
    setDraft((current) => ({
      ...current,
      candidates: current.candidates.filter((_, i) => i !== index),
    }));
  }

  const selectedSuggestionKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const candidate of draft.candidates) {
      keys.add(`${candidate.startsAt}|${candidate.endsAt ?? ""}`);
    }
    return keys;
  }, [draft.candidates]);

  function applySuggestion(suggestion: TimeRecommendation) {
    setStepError(null);
    const merged = mergeWallClockIntoCandidates(draft.candidates, {
      startsAt: suggestion.startsAt,
      endsAt: suggestion.endsAt,
    });
    if (merged.candidates.length === draft.candidates.length) {
      return;
    }
    setDraft((current) => ({ ...current, candidates: merged.candidates }));
  }

  const reviewMissing: string[] = [];
  if (!draft.gatheringType) {
    reviewMissing.push("Type of hui");
  }
  if (draft.candidates.length < 1) {
    reviewMissing.push("At least one proposed time");
  }
  const canOneOff = settings.oneOffEventsAllowed;
  const canRecurring = settings.recurringEventsEnabled;

  const pastDateWarning = buildProposingPastDateWarning({
    draft,
    timeZone: settings.timezone,
    todayDateOnly,
    nowIso: new Date().toISOString(),
    pendingDateOnly: step === "time" ? timeDate : undefined,
    pendingStartTime: step === "time" ? timeStart : undefined,
  });

  function persistDraftForNavigation() {
    writeStoredProposalDraft(groupId, {
      step,
      draft,
      timeDate,
      timeStart,
      timeEnd,
      meetFrequency,
    });
  }

  return (
    <div className="space-y-6">
      {isFirstGroupEvent ? (
        <p className="text-sm font-semibold text-muted-foreground">{HUI_ONE_LINE_EXPLAINER}</p>
      ) : null}
      <nav aria-label="Proposal steps">
        <ol className="flex gap-1.5">
          {STEPS.map((id, index) => (
            <li
              key={id}
              aria-current={id === step ? "step" : undefined}
              className="min-w-0 flex-1"
            >
              <span
                className={`block h-1.5 rounded-full transition-colors duration-300 ${
                  index <= stepIndex ? "bg-primary" : "bg-muted"
                }`}
              />
              <span
                className={`mt-1.5 block text-xs font-extrabold ${
                  id === step ? "text-foreground" : "text-muted-foreground"
                }`}
              >
                {index + 1}. {stepLabels[id]}
              </span>
            </li>
          ))}
        </ol>
      </nav>

      {step === "name" ? (
        <section className="hui-rise space-y-5">
          <h2 className="hui-type-page-title text-foreground">What are you planning?</h2>
          <label className="hui-label">
            <span>Type of hui</span>
            <select
              className="hui-input"
              value={draft.gatheringType ?? ""}
              onChange={(event) => {
                const value = event.target.value as GatheringType | "";
                setDraft((current) => ({
                  ...current,
                  gatheringType: value || null,
                  gatheringTypeCustom:
                    value === "other" ? current.gatheringTypeCustom : "",
                }));
              }}
              required
            >
              <option value="" disabled>
                Choose one…
              </option>
              {GATHERING_TYPES.map((type) => (
                <option key={type} value={type}>
                  {gatheringTypeLabel(type)}
                </option>
              ))}
            </select>
          </label>
          {draft.gatheringType === "other" ? (
            <label className="hui-label">
              <span>Describe it</span>
              <input
                className="hui-input"
                value={draft.gatheringTypeCustom}
                maxLength={80}
                placeholder="Birthday picnic, book club…"
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    gatheringTypeCustom: event.target.value,
                  }))
                }
                required
              />
            </label>
          ) : null}
          <label className="hui-label">
            <span>Name this hui (optional)</span>
            <input
              className="hui-input text-lg font-bold"
              value={draft.title}
              placeholder="Mum's birthday, October family dinner…"
              onChange={(event) =>
                setDraft((current) => ({ ...current, title: event.target.value }))
              }
            />
          </label>
          <details className="hui-details rounded-hui-lg bg-surface hui-shadow-sm">
            <summary className="hui-focus-ring flex min-h-14 items-center justify-between gap-3 rounded-hui-lg px-5 py-3">
              <span>
                <span className="block font-extrabold text-foreground">Add a place or note</span>
                <span className="block text-sm font-semibold text-muted-foreground">Optional</span>
              </span>
              <span className="hui-details-chevron text-muted-foreground" aria-hidden="true">
                <ChevronDownIcon size={20} />
              </span>
            </summary>
            <div className="space-y-4 px-5 pb-5">
              <EventLocationFields
                location={draft.location}
                onLocationChange={(location) => setDraft((current) => ({ ...current, location }))}
                coordinates={draft.locationCoordinates ?? null}
                onCoordinatesChange={(locationCoordinates) =>
                  setDraft((current) => ({ ...current, locationCoordinates }))
                }
                locationLabel="Proposed place (optional)"
                searchLabel="Search for a place"
                helperText={
                  settings.hostingEnabled
                    ? "Optional. The accepted host confirms the final place — you do not need to pin it now."
                    : "Optional. The written place is the main detail; you can pin it on the map too."
                }
              />
              <label className="hui-label">
                <span>Notes for the group</span>
                <textarea
                  rows={3}
                  className="hui-input"
                  value={draft.notes}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, notes: event.target.value }))
                  }
                />
              </label>
            </div>
          </details>
          {canOneOff || canRecurring ? (
            isFirstGroupEvent && !establishedRecurrence ? (
            <fieldset className="space-y-3">
              <legend className="hui-label">
                <span>How often does this group meet?</span>
              </legend>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {canOneOff ? (
                  <label
                    className={cn(
                      "hui-focus-ring flex min-h-12 cursor-pointer items-center justify-center rounded-hui-lg px-3 py-2 text-center text-sm font-extrabold",
                      meetFrequency === "once"
                        ? "border-2 border-primary bg-sage-soft text-foreground"
                        : "border border-transparent bg-muted text-foreground",
                    )}
                  >
                    <input
                      type="radio"
                      name="meet_frequency"
                      className="sr-only"
                      checked={meetFrequency === "once"}
                      onChange={() => selectMeetFrequency("once")}
                    />
                    Just this once
                  </label>
                ) : null}
                {canRecurring
                  ? FIRST_GROUP_CADENCE_PRESETS.map((preset) => (
                      <label
                        key={preset.id}
                        className={cn(
                          "hui-focus-ring flex min-h-12 cursor-pointer items-center justify-center rounded-hui-lg px-3 py-2 text-center text-sm font-extrabold",
                          meetFrequency === preset.id
                            ? "border-2 border-primary bg-sage-soft text-foreground"
                            : "border border-transparent bg-muted text-foreground",
                        )}
                      >
                        <input
                          type="radio"
                          name="meet_frequency"
                          className="sr-only"
                          checked={meetFrequency === preset.id}
                          onChange={() => selectMeetFrequency(preset.id)}
                        />
                        {preset.label}
                      </label>
                    ))
                  : null}
                {canRecurring ? (
                  <label
                    className={cn(
                      "hui-focus-ring flex min-h-12 cursor-pointer items-center justify-center rounded-hui-lg px-3 py-2 text-center text-sm font-extrabold sm:col-span-2",
                      meetFrequency === "custom"
                        ? "border-2 border-primary bg-sage-soft text-foreground"
                        : "border border-transparent bg-muted text-foreground",
                    )}
                  >
                    <input
                      type="radio"
                      name="meet_frequency"
                      className="sr-only"
                      checked={meetFrequency === "custom"}
                      onChange={() => selectMeetFrequency("custom")}
                    />
                    Custom
                  </label>
                ) : null}
              </div>
              {meetFrequency === "custom" && canRecurring ? (
                <div className="flex flex-wrap gap-3 rounded-hui-lg bg-muted p-4">
                  <label className="block text-sm font-semibold text-foreground">
                    Every
                    <input
                      type="number"
                      min={1}
                      max={52}
                      className="mt-1 hui-input w-20"
                      value={draft.recurrence?.intervalCount ?? 5}
                      onChange={(event) => {
                        const intervalCount = Number(event.target.value);
                        setDraft((current) => ({
                          ...current,
                          eventKind: "recurring",
                          recurrence: {
                            ...(current.recurrence ?? {
                              seriesTitle: "",
                              intervalUnit: "week",
                              intervalCount: 5,
                              startsOn: "",
                              planningTargetDate: null,
                            }),
                            intervalCount,
                          },
                        }));
                      }}
                    />
                  </label>
                  <label className="block text-sm font-semibold text-foreground">
                    Unit
                    <select
                      className="mt-1 hui-input"
                      value={draft.recurrence?.intervalUnit ?? "week"}
                      onChange={(event) => {
                        const intervalUnit = event.target.value as "week" | "month";
                        setDraft((current) => ({
                          ...current,
                          eventKind: "recurring",
                          recurrence: {
                            ...(current.recurrence ?? {
                              seriesTitle: "",
                              intervalUnit: "week",
                              intervalCount: 5,
                              startsOn: "",
                              planningTargetDate: null,
                            }),
                            intervalUnit,
                          },
                        }));
                      }}
                    >
                      <option value="week">Week(s)</option>
                      <option value="month">Month(s)</option>
                    </select>
                  </label>
                  <p className="text-sm font-semibold text-muted-foreground">
                    {draft.recurrence
                      ? formatCadenceLabel({
                          intervalUnit: draft.recurrence.intervalUnit,
                          intervalCount: draft.recurrence.intervalCount,
                        })
                      : null}
                  </p>
                </div>
              ) : null}
            </fieldset>
            ) : null
          ) : null}
          {establishedRecurrence && canOneOff && canRecurring ? (
            <fieldset className="space-y-3">
              <legend className="hui-label">
                <span>Is this part of how often you meet?</span>
              </legend>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <label
                  className={cn(
                    "hui-focus-ring flex min-h-12 cursor-pointer items-center justify-center rounded-hui-lg px-3 py-2 text-center text-sm font-extrabold",
                    draft.eventKind === "one_off"
                      ? "border-2 border-primary bg-sage-soft text-foreground"
                      : "border border-transparent bg-muted text-foreground",
                  )}
                >
                  <input
                    type="radio"
                    name="established_planning_kind"
                    className="sr-only"
                    checked={draft.eventKind === "one_off"}
                    onChange={() => selectEstablishedPlanningKind("one_off")}
                  />
                  Just this once
                </label>
                <label
                  className={cn(
                    "hui-focus-ring flex min-h-12 cursor-pointer items-center justify-center rounded-hui-lg px-3 py-2 text-center text-sm font-extrabold",
                    draft.eventKind === "recurring"
                      ? "border-2 border-primary bg-sage-soft text-foreground"
                      : "border border-transparent bg-muted text-foreground",
                  )}
                >
                  <input
                    type="radio"
                    name="established_planning_kind"
                    className="sr-only"
                    checked={draft.eventKind === "recurring"}
                    onChange={() => selectEstablishedPlanningKind("recurring")}
                  />
                  Recurring
                  {establishedCadence ? ` (${formatCadenceLabel(establishedCadence)})` : ""}
                </label>
              </div>
            </fieldset>
          ) : null}
          {draft.eventKind === "recurring" && canRecurring && establishedRecurrence ? (
            <p className="rounded-hui-lg bg-muted px-4 py-3 text-sm font-semibold text-muted-foreground">
              This hui follows how often you meet
              {establishedCadence ? ` (${formatCadenceLabel(establishedCadence)})` : ""}. Proposed
              times are options — not confirmed dates yet.
              {canManageRecurrence ? (
                <>
                  {" "}
                  <Link
                    href={`/groups/${groupId}#recurring-planning`}
                    className="hui-link font-extrabold text-foreground"
                    onClick={persistDraftForNavigation}
                  >
                    Change how often you meet
                  </Link>
                </>
              ) : null}
            </p>
          ) : null}
          {draft.eventKind === "recurring" && canRecurring && establishedRecurrence ? (
            <WallClockDateField
              label="Planning date for this cycle"
              value={draft.recurrence?.planningTargetDate ?? ""}
              onChange={(value) =>
                setDraft((current) => {
                  if (current.eventKind !== "recurring" || !current.recurrence) {
                    return current;
                  }
                  return {
                    ...current,
                    recurrence: {
                      ...current.recurrence,
                      planningTargetDate: value,
                      startsOn: value,
                    },
                  };
                })
              }
            />
          ) : null}
        </section>
      ) : null}

      {step === "time" ? (
        <section className="hui-rise space-y-5">
          <div>
            <h2 className="hui-type-page-title text-foreground">When could it happen?</h2>
            <p className="hui-type-supporting mt-2">
              Suggest a time. The group answers before anything is confirmed.
            </p>
            {draft.recurrence?.planningTargetDate ? (
              <p className="hui-message-note mt-3" role="status">
                First proposed time sets the planning date for this cycle (
                {formatNominalPlanningDate(draft.recurrence.planningTargetDate)}).
              </p>
            ) : null}
            {pastDateWarning ? (
              <div className="mt-3">
                <ProposalPastDateWarning
                  title={pastDateWarning.title}
                  detail={pastDateWarning.detail}
                />
              </div>
            ) : null}
          </div>
          <SuggestedTimesList
            suggestions={timeRecommendations}
            timeZone={settings.timezone}
            selectedKeys={selectedSuggestionKeys}
            onSelect={applySuggestion}
            hideEmptyState={draft.candidates.length > 0}
          />
          {timeAddedMessage ? (
            <p className="hui-message-success" role="status">{timeAddedMessage}</p>
          ) : null}
          {draft.candidates.length > 0 ? (
            <div className="space-y-2">
              <p className="text-sm font-extrabold text-foreground">
                Times you&apos;re proposing ({draft.candidates.length})
              </p>
            <ul className="space-y-2">
              {draft.candidates.map((candidate, index) => (
                <li
                  key={`${candidate.startsAt}-${candidate.endsAt ?? ""}`}
                  className="flex min-h-14 items-center justify-between gap-3 rounded-hui-lg bg-sage-soft px-4 py-2 text-sm font-extrabold text-foreground"
                >
                  <span>
                    {formatCompactEventTimeRange(
                      candidate.startsAt,
                      candidate.endsAt,
                      settings.timezone,
                    )}
                  </span>
                  <button
                    type="button"
                    className="hui-link-danger text-sm"
                    onClick={() => removeCandidate(index)}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
            </div>
          ) : null}
          <div className="space-y-4 rounded-hui-xl bg-surface p-5 hui-shadow-md">
            <p className="font-extrabold text-foreground">Add a time</p>
            <WallClockDateField
              label="Date"
              value={timeDate}
              onChange={setTimeDate}
              min={todayDateOnly}
            />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <WallClockTimeField
                label="Starts"
                value={timeStart}
                onChange={setTimeStart}
              />
              <WallClockTimeField
                label="Ends (optional)"
                value={timeEnd}
                onChange={setTimeEnd}
                clearable
              />
            </div>
            <PendingButton type="button" variant="soft" onClick={addCandidate}>
              Add time
            </PendingButton>
          </div>
          <div className="w-full min-w-0 max-w-full space-y-3 rounded-hui-xl bg-surface p-4 sm:p-5 hui-shadow-md">
            <div className="px-1">
              <p className="text-sm font-extrabold text-foreground">Will food be part of it?</p>
              <p className="mt-1 text-xs font-semibold text-muted-foreground">
                Optional — helps with dietary coordination. You can skip if you&apos;re not sure yet.
              </p>
            </div>
            <div className="grid w-full min-w-0 grid-cols-2 gap-2 sm:grid-cols-4">
              {(
                [
                  ["yes", "Yes"],
                  ["no", "No"],
                  ["unsure", "Not sure"],
                  ["skip", "Skip"],
                ] as const
              ).map(([value, label]) => {
                const foodValue = value === "skip" ? null : value;
                const selected =
                  value === "skip"
                    ? !draft.foodInvolvement
                    : draft.foodInvolvement === value;
                return (
                  <label
                    key={value}
                    className={cn(
                      "hui-focus-ring flex min-h-12 w-full min-w-0 cursor-pointer items-center justify-center gap-2 rounded-hui-lg px-3 py-3 text-sm font-extrabold",
                      selected
                        ? "border-2 border-primary bg-sage-soft text-foreground"
                        : "border border-transparent bg-muted text-foreground",
                    )}
                  >
                    <input
                      type="radio"
                      name="food_involvement_time_step"
                      className="sr-only"
                      checked={selected}
                      onChange={() =>
                        setDraft((current) => ({
                          ...current,
                          foodInvolvement: foodValue as EventFoodInvolvement | null,
                          requestedContributions:
                            foodValue === "no" ? [] : current.requestedContributions,
                        }))
                      }
                    />
                    <span className="min-w-0 text-center leading-snug">{label}</span>
                    {selected && value !== "skip" ? (
                      <CheckIcon size={18} strokeWidth={3} className="shrink-0" />
                    ) : null}
                  </label>
                );
              })}
            </div>
          </div>
          <ProposalContributionRequestFields
            categories={activeCategories}
            requestedContributions={draft.requestedContributions}
            onChange={(requestedContributions) =>
              setDraft((current) => ({ ...current, requestedContributions }))
            }
          />
        </section>
      ) : null}

      {step === "review" ? (
        <section
          className="hui-rise space-y-5 pb-[calc(5.5rem+env(safe-area-inset-bottom))]"
        >
          <h2 className="hui-type-page-title text-foreground">Ready to propose?</h2>
          {pastDateWarning ? (
            <ProposalPastDateWarning
              title={pastDateWarning.title}
              detail={pastDateWarning.detail}
            />
          ) : null}
          {reviewMissing.length > 0 ? (
            <p className="hui-message-error" role="alert">
              Still needed: {reviewMissing.join(", ")}
            </p>
          ) : null}
          <EventConfirmRuleField
            value={draft.confirmRule}
            onChange={(confirmRule) =>
              setDraft((current) => ({ ...current, confirmRule }))
            }
          />
          {settings.hostingEnabled ? (
            <>
              <HuiSwitchField
                label="Who's hosting?"
                description="Will you host at your place? Optional — someone else can host later."
                checked={draft.organiserWillHost}
                onCheckedChange={(checked) =>
                  setDraft((current) => ({
                    ...current,
                    organiserWillHost: checked,
                  }))
                }
              />
              <HuiSwitchField
              label="Host sets the place"
              description="When on, whoever accepts hosting also confirms where it happens. Turn off if the place is not decided yet."
              checked={draft.hostPlaceRequired}
              onCheckedChange={(checked) =>
                setDraft((current) => ({
                  ...current,
                  hostPlaceRequired: checked,
                }))
              }
            />
            </>
          ) : null}
          <dl className="grid gap-4 rounded-hui-xl bg-surface p-5 text-sm font-semibold text-foreground hui-shadow-md [&_dt]:hui-type-label [&_dt]:text-muted-foreground [&_dd]:mt-1 [&_dd]:text-base [&_dd]:font-extrabold">
            <div>
              <dt>Name</dt>
              <dd>{draft.title.trim() || "—"}</dd>
            </div>
            <div>
              <dt>Food</dt>
              <dd>
                {draft.foodInvolvement === "yes"
                  ? "Yes"
                  : draft.foodInvolvement === "no"
                    ? "No"
                    : draft.foodInvolvement === "unsure"
                      ? "Not sure"
                      : "Decide later"}
              </dd>
            </div>
            <div>
              <dt>Proposed times</dt>
              <dd>
                {draft.candidates.length > 0
                  ? draft.candidates.map((candidate) => (
                      <div key={`${candidate.startsAt}-${candidate.endsAt ?? ""}`}>
                        {formatCompactEventTimeRange(
                          candidate.startsAt,
                          candidate.endsAt,
                          settings.timezone,
                        )}
                      </div>
                    ))
                  : "—"}
              </dd>
            </div>
            <div>
              <dt>Proposed place</dt>
              <dd>
                {draft.location.trim() || (draft.locationCoordinates ? "Pinned on the map" : "Not specified")}
                {draft.location.trim() && draft.locationCoordinates ? (
                  <span className="block text-sm font-semibold text-muted-foreground">
                    Pinned on the map
                  </span>
                ) : null}
              </dd>
            </div>
            <div>
              <dt>Host</dt>
              <dd>{hostSummary(draft, settings.hostingEnabled)}</dd>
            </div>
            <div>
              <dt>Who&apos;s bringing what</dt>
              <dd>
                {draft.requestedContributions.length > 0
                  ? draft.requestedContributions.map((row) => row.label).join(", ")
                  : "None requested"}
              </dd>
            </div>
            <div>
              <dt>Reply by</dt>
              <dd>
                {proposalReplyByPreviewLabel(
                  replyDeadlineLocal
                    ? wallClockToUtcIso(replyDeadlineLocal, settings.timezone)
                    : null,
                  settings.timezone,
                )}
              </dd>
            </div>
          </dl>
          <form
            action={formAction}
            className="space-y-3"
            onSubmit={() => {
              clearStoredProposalDraft(groupId);
            }}
          >
            <input type="hidden" name="group_id" value={groupId} />
            <input type="hidden" name="proposal_draft" value={JSON.stringify(draft)} />
            <label className="hui-label block">
              <span>When should people reply by? (optional)</span>
              <input
                type="datetime-local"
                name="response_deadline_at"
                value={replyDeadlineLocal}
                onChange={(event) => setReplyDeadlineLocal(event.target.value)}
                className="hui-input max-w-full"
              />
            </label>
            {actionState.error ? (
              <p className="hui-message-error" role="alert">
                {actionState.error}
              </p>
            ) : null}
            <PendingButton
              type="submit"
              disabled={reviewMissing.length > 0 || Boolean(pastDateWarning)}
              pendingLabel="Proposing…"
              size="touch"
            >
              Propose this hui
            </PendingButton>
          </form>
        </section>
      ) : null}

      {stepError ? (
        <p className="hui-message-error" role="alert">{stepError}</p>
      ) : null}

      {step !== "review" ? (
        <div className="flex gap-3">
          {stepIndex > 0 ? (
            <PendingButton type="button" variant="soft" size="lg" onClick={goBack}>
              Back
            </PendingButton>
          ) : null}
          <PendingButton type="button" size="lg" onClick={goNext} className="flex-1">
            Continue
          </PendingButton>
        </div>
      ) : (
        <PendingButton type="button" variant="soft" onClick={goBack}>
          Back
        </PendingButton>
      )}
    </div>
  );
}
