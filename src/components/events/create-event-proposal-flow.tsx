"use client";

import { useActionState, useMemo, useState } from "react";

import type { EventActionState } from "@/app/events/actions";
import { proposeGroupEventAction } from "@/app/events/proposal-actions";
import {
  WallClockDateField,
  WallClockTimeField,
} from "@/components/events/wall-clock-picker-field";
import { ChevronDownIcon, CheckIcon } from "@/components/hui/icons";
import { EventLocationFields } from "@/components/map/event-location-fields";
import { PendingButton } from "@/components/ui/pending-button";
import type { EventFoodInvolvement } from "@/domain/events/food";
import { formatCompactEventTimeRange } from "@/domain/datetime/timezone";
import type { EventProposalDraft } from "@/domain/events/proposal";
import { mergeWallClockIntoCandidates, parseWallClockCandidate } from "@/domain/events/proposal";
import type { ContributionCategoryRow } from "@/lib/contributions/types";
import type { GroupMemberRow, GroupSettingsRow } from "@/lib/groups/types";
import { cn } from "@/lib/ui/cn";

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
  settings: GroupSettingsRow;
  isFirstGroupEvent: boolean;
  members: GroupMemberRow[];
  contributionCategories: ContributionCategoryRow[];
};

const initialActionState: EventActionState = {};

function emptyDraft(settings: GroupSettingsRow): EventProposalDraft {
  const defaultKind = settings.oneOffEventsAllowed ? "one_off" : "recurring";
  return {
    title: "",
    location: "",
    notes: "",
    eventKind: defaultKind,
    recurrence: {
      seriesTitle: "",
      intervalUnit: "month",
      intervalCount: 1,
      startsOn: "",
    },
    candidates: [],
    initialHostUserId: "suggest",
    foodInvolvement: null,
    hostPlaceRequired: true,
  };
}

function hostSummary(
  draft: EventProposalDraft,
  members: GroupMemberRow[],
  isFirstGroupEvent: boolean,
  hostingEnabled: boolean,
): string {
  if (!isFirstGroupEvent || !hostingEnabled) {
    return "Hui will suggest a host when people respond.";
  }
  if (draft.initialHostUserId === "suggest") {
    return "Let Hui suggest when people respond.";
  }
  if (draft.initialHostUserId === null) {
    return "No host for this event.";
  }
  const member = members.find((m) => m.userId === draft.initialHostUserId);
  return member ? `Hosted by ${member.displayName}` : "Hosted by a group member.";
}

export function CreateEventProposalFlow({
  groupId,
  settings,
  isFirstGroupEvent,
  members,
  contributionCategories,
}: CreateEventProposalFlowProps) {
  const [step, setStep] = useState<Step>("name");
  const [draft, setDraft] = useState<EventProposalDraft>(() => emptyDraft(settings));
  const [stepError, setStepError] = useState<string | null>(null);
  const [timeDate, setTimeDate] = useState("");
  const [timeStart, setTimeStart] = useState("12:00");
  // The end time is optional: an empty value means "start only".
  const [timeEnd, setTimeEnd] = useState("");

  const [actionState, formAction] = useActionState(
    proposeGroupEventAction,
    initialActionState,
  );

  const stepIndex = STEPS.indexOf(step);
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
      if (!draft.title.trim()) {
        setStepError("Enter an event name.");
        return;
      }
      if (draft.eventKind === "recurring") {
        const seriesTitle = (draft.recurrence?.seriesTitle || draft.title).trim();
        if (!seriesTitle) {
          setStepError("Enter a series title for recurrence.");
          return;
        }
      }
      goTo("time");
      return;
    }
    if (step === "time") {
      const parsed = parseWallClockCandidate(timeDate, timeStart, timeEnd, settings.timezone);
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
      setDraft((current) => ({ ...current, candidates: merged.candidates }));
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
    const parsed = parseWallClockCandidate(timeDate, timeStart, timeEnd, settings.timezone);
    if (!parsed) {
      setStepError(
        timeEnd.trim()
          ? "Enter a valid date and times. The end must be after the start."
          : "Enter a valid date and start time.",
      );
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
  }

  function removeCandidate(index: number) {
    setDraft((current) => ({
      ...current,
      candidates: current.candidates.filter((_, i) => i !== index),
    }));
  }

  const reviewMissing: string[] = [];
  if (!draft.title.trim()) {
    reviewMissing.push("Event name");
  }
  if (draft.candidates.length < 1) {
    reviewMissing.push("At least one proposed time");
  }
  if (!draft.foodInvolvement) {
    reviewMissing.push("Whether food is involved");
  }

  const canOneOff = settings.oneOffEventsAllowed;
  const canRecurring = settings.recurringEventsEnabled;

  return (
    <div className="space-y-6">
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
          <h2 className="hui-type-page-title text-foreground">What shall we call it?</h2>
          <label className="hui-label">
            <span>Name</span>
            <input
              className="hui-input text-lg font-bold"
              value={draft.title}
              placeholder="Sunday roast, hot pot night…"
              onChange={(event) =>
                setDraft((current) => ({ ...current, title: event.target.value }))
              }
              required
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
            <label className="hui-label">
              <span>Event type</span>
              <select
                className="hui-input"
                value={draft.eventKind}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    eventKind: event.target.value as EventProposalDraft["eventKind"],
                  }))
                }
              >
                {canOneOff ? <option value="one_off">One-off</option> : null}
                {canRecurring ? <option value="recurring">Recurring series</option> : null}
              </select>
            </label>
          ) : null}
          {draft.eventKind === "recurring" && canRecurring ? (
            <fieldset className="space-y-4 rounded-hui-lg bg-muted p-5">
              <legend className="px-1 text-sm font-extrabold">Recurrence</legend>
              <label className="hui-label">
                <span>Series title</span>
                <input
                  className="hui-input"
                  value={draft.recurrence?.seriesTitle ?? ""}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      recurrence: {
                        ...(current.recurrence ?? {
                          seriesTitle: "",
                          intervalUnit: "month",
                          intervalCount: 1,
                          startsOn: "",
                        }),
                        seriesTitle: event.target.value,
                      },
                    }))
                  }
                />
              </label>
              <label className="hui-label">
                <span>Cadence</span>
                <select
                  className="hui-input"
                  value={draft.recurrence?.intervalUnit ?? "month"}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      recurrence: {
                        ...(current.recurrence ?? {
                          seriesTitle: "",
                          intervalUnit: "month",
                          intervalCount: 1,
                          startsOn: "",
                        }),
                        intervalUnit: event.target.value as "week" | "month",
                      },
                    }))
                  }
                >
                  <option value="week">Weekly</option>
                  <option value="month">Monthly</option>
                </select>
              </label>
              <label className="hui-label">
                <span>Every (interval)</span>
                <input
                  type="number"
                  min={1}
                  className="hui-input"
                  value={draft.recurrence?.intervalCount ?? 1}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      recurrence: {
                        ...(current.recurrence ?? {
                          seriesTitle: "",
                          intervalUnit: "month",
                          intervalCount: 1,
                          startsOn: "",
                        }),
                        intervalCount: Number(event.target.value),
                      },
                    }))
                  }
                />
              </label>
              <WallClockDateField
                label="Series starts on"
                value={draft.recurrence?.startsOn ?? ""}
                onChange={(startsOn) =>
                  setDraft((current) => ({
                    ...current,
                    recurrence: {
                      ...(current.recurrence ?? {
                        seriesTitle: "",
                        intervalUnit: "month",
                        intervalCount: 1,
                        startsOn: "",
                      }),
                      startsOn,
                    },
                  }))
                }
              />
            </fieldset>
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
          </div>
          {draft.candidates.length > 0 ? (
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
          ) : (
            <p className="hui-message-note" role="status">
              Choose a date and time, then tap Continue. Add another time only if you want more than
              one option.
            </p>
          )}
          <div className="space-y-4 rounded-hui-xl bg-surface p-5 hui-shadow-md">
            <p className="font-extrabold text-foreground">Add a time</p>
            <WallClockDateField
              label="Date"
              value={timeDate}
              onChange={setTimeDate}
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
              Add another time
            </PendingButton>
          </div>
        </section>
      ) : null}

      {step === "review" ? (
        <section className="hui-rise space-y-5">
          <h2 className="hui-type-page-title text-foreground">Ready to propose?</h2>
          {reviewMissing.length > 0 ? (
            <p className="hui-message-error" role="alert">
              Still needed: {reviewMissing.join(", ")}
            </p>
          ) : null}
          <fieldset className="w-full min-w-0 max-w-full space-y-3 overflow-hidden rounded-hui-xl bg-surface p-4 sm:p-5 hui-shadow-md">
            <legend className="block w-full min-w-0 px-1 text-sm font-extrabold text-foreground [text-wrap:pretty]">
              Will food be involved?
            </legend>
            <p className="w-full min-w-0 text-xs font-semibold text-muted-foreground [text-wrap:pretty]">
              Helps the group know whether dietary coordination matters for this hui.
            </p>
            <div className="grid w-full min-w-0 grid-cols-1 gap-2">
              {(
                [
                  ["yes", "Yes"],
                  ["no", "No"],
                  ["unsure", "Not sure"],
                ] as const
              ).map(([value, label]) => {
                const selected = draft.foodInvolvement === value;
                return (
                  <label
                    key={value}
                    className={cn(
                      "hui-focus-ring flex min-h-12 w-full min-w-0 cursor-pointer items-center justify-center gap-2 rounded-hui-lg px-3 py-3 text-sm font-extrabold sm:px-4",
                      selected
                        ? "border-2 border-primary bg-sage-soft text-foreground"
                        : "border border-transparent bg-muted text-foreground",
                    )}
                  >
                    <input
                      type="radio"
                      name="food_involvement"
                      className="sr-only"
                      checked={selected}
                      onChange={() =>
                        setDraft((current) => ({
                          ...current,
                          foodInvolvement: value as EventFoodInvolvement,
                        }))
                      }
                    />
                    <span className="min-w-0 text-center leading-snug">{label}</span>
                    {selected ? <CheckIcon size={18} strokeWidth={3} className="shrink-0" /> : null}
                  </label>
                );
              })}
            </div>
          </fieldset>
          {settings.hostingEnabled ? (
            <label className="flex min-w-0 cursor-pointer items-start gap-3 rounded-hui-xl bg-surface p-4 hui-shadow-md">
              <input
                type="checkbox"
                className="mt-1 size-4 shrink-0 accent-primary"
                checked={draft.hostPlaceRequired}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    hostPlaceRequired: event.target.checked,
                  }))
                }
              />
              <span className="min-w-0 [text-wrap:pretty]">
                <span className="block text-sm font-extrabold text-foreground">
                  Host confirms the venue
                </span>
                <span className="mt-1 block text-xs font-semibold text-muted-foreground">
                  When on, whoever accepts hosting sets or confirms the place as part of accepting.
                  Turn off for gatherings where the venue does not matter yet.
                </span>
              </span>
            </label>
          ) : null}
          <dl className="grid gap-4 rounded-hui-xl bg-surface p-5 text-sm font-semibold text-foreground hui-shadow-md [&_dt]:hui-type-label [&_dt]:text-muted-foreground [&_dd]:mt-1 [&_dd]:text-base [&_dd]:font-extrabold">
            <div>
              <dt>Name</dt>
              <dd>{draft.title.trim() || "—"}</dd>
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
              <dd>{hostSummary(draft, members, isFirstGroupEvent, settings.hostingEnabled)}</dd>
            </div>
            <div>
              <dt>Contributions</dt>
              <dd>
                {activeCategories.length > 0
                  ? `${activeCategories.length} categories ready after confirmation`
                  : "None configured yet"}
              </dd>
            </div>
          </dl>
          {isFirstGroupEvent && settings.hostingEnabled ? (
            <label className="hui-label">
              <span>Initial host (first gathering)</span>
              <p className="mt-1 text-xs font-normal text-muted-foreground">
                Your choice is a proposal — they still accept or ask to swap.
              </p>
              <select
                className="hui-input"
                value={
                  draft.initialHostUserId === "suggest"
                    ? ""
                    : draft.initialHostUserId === null
                      ? "__none__"
                      : draft.initialHostUserId
                }
                onChange={(event) => {
                  const value = event.target.value;
                  setDraft((current) => ({
                    ...current,
                    initialHostUserId:
                      value === ""
                        ? "suggest"
                        : value === "__none__"
                          ? null
                          : value,
                  }));
                }}
              >
                <option value="">Let Hui suggest when people respond</option>
                <option value="__none__">No host for this event</option>
                {members.map((member) => (
                  <option key={member.userId} value={member.userId}>
                    {member.displayName}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <form action={formAction} className="space-y-3">
            <input type="hidden" name="group_id" value={groupId} />
            <input type="hidden" name="proposal_draft" value={JSON.stringify(draft)} />
            {actionState.error ? (
              <p className="hui-message-error" role="alert">
                {actionState.error}
              </p>
            ) : null}
            <PendingButton
              type="submit"
              disabled={reviewMissing.length > 0}
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
