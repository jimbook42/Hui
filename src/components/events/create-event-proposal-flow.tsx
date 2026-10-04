"use client";

import { useActionState, useMemo, useState } from "react";

import type { EventActionState } from "@/app/events/actions";
import { proposeGroupEventAction } from "@/app/events/proposal-actions";
import { PendingButton } from "@/components/ui/pending-button";
import { formatCompactEventTimeRange } from "@/domain/datetime/timezone";
import type { EventProposalDraft } from "@/domain/events/proposal";
import { parseWallClockCandidate } from "@/domain/events/proposal";
import type { ContributionCategoryRow } from "@/lib/contributions/types";
import type { GroupMemberRow, GroupSettingsRow } from "@/lib/groups/types";

const STEPS = ["name", "time", "place", "bring", "review"] as const;
type Step = (typeof STEPS)[number];

const stepLabels: Record<Step, string> = {
  name: "Name",
  time: "Time",
  place: "Place",
  bring: "What to bring",
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
  const [timeEnd, setTimeEnd] = useState("15:00");

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
      if (draft.candidates.length < 1) {
        setStepError("Add at least one proposed time.");
        return;
      }
      goTo("place");
      return;
    }
    if (step === "place") {
      goTo("bring");
      return;
    }
    if (step === "bring") {
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
      setStepError("Enter a valid date and start/end times.");
      return;
    }
    const duplicate = draft.candidates.some(
      (row) => row.startsAt === parsed.startsAt && row.endsAt === parsed.endsAt,
    );
    if (duplicate) {
      setStepError("That time is already in your proposal.");
      return;
    }
    setDraft((current) => ({
      ...current,
      candidates: [...current.candidates, parsed],
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

  const canOneOff = settings.oneOffEventsAllowed;
  const canRecurring = settings.recurringEventsEnabled;

  return (
    <div className="space-y-6">
      <nav aria-label="Proposal steps" className="flex flex-wrap gap-2 text-xs">
        {STEPS.map((id, index) => {
          const isActive = id === step;
          const isDone = index < stepIndex;
          return (
            <span
              key={id}
              className={`rounded-full px-2.5 py-1 ${
                isActive
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                  : isDone
                    ? "bg-zinc-200 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200"
                    : "bg-zinc-100 text-zinc-500 dark:bg-zinc-900 dark:text-zinc-500"
              }`}
            >
              {stepLabels[id]}
            </span>
          );
        })}
      </nav>

      {step === "name" ? (
        <section className="space-y-4">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Name</h2>
          <label className="block text-sm font-medium text-zinc-800 dark:text-zinc-200">
            <span>Event name</span>
            <input
              className="mt-1.5 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 shadow-sm outline-none ring-zinc-400 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
              value={draft.title}
              onChange={(event) =>
                setDraft((current) => ({ ...current, title: event.target.value }))
              }
              required
            />
          </label>
          {canOneOff || canRecurring ? (
            <label className="block text-sm font-medium text-zinc-800 dark:text-zinc-200">
              <span>Event type</span>
              <select
                className="mt-1.5 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
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
            <fieldset className="space-y-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
              <legend className="px-1 text-sm font-medium">Recurrence</legend>
              <label className="block text-sm">
                <span>Series title</span>
                <input
                  className="mt-1.5 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
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
              <label className="block text-sm">
                <span>Cadence</span>
                <select
                  className="mt-1.5 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
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
              <label className="block text-sm">
                <span>Every (interval)</span>
                <input
                  type="number"
                  min={1}
                  className="mt-1.5 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
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
              <label className="block text-sm">
                <span>Series starts on</span>
                <input
                  type="date"
                  className="mt-1.5 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
                  value={draft.recurrence?.startsOn ?? ""}
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
                        startsOn: event.target.value,
                      },
                    }))
                  }
                />
              </label>
            </fieldset>
          ) : null}
        </section>
      ) : null}

      {step === "time" ? (
        <section className="space-y-4">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Time</h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Propose when this gathering could happen. The group will respond before anything is
            confirmed.
          </p>
          {draft.candidates.length > 0 ? (
            <ul className="space-y-2">
              {draft.candidates.map((candidate, index) => (
                <li
                  key={`${candidate.startsAt}-${candidate.endsAt}`}
                  className="flex items-center justify-between gap-3 rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800"
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
                    className="text-sm text-red-600 underline-offset-2 hover:underline dark:text-red-400"
                    onClick={() => removeCandidate(index)}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-amber-800 dark:text-amber-200" role="status">
              Add at least one time before you can propose this event.
            </p>
          )}
          <div className="space-y-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
            <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">Add a time</p>
            <label className="block text-sm">
              <span>Date</span>
              <input
                type="date"
                className="mt-1.5 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
                value={timeDate}
                onChange={(event) => setTimeDate(event.target.value)}
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm">
                <span>Starts</span>
                <input
                  type="time"
                  className="mt-1.5 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
                  value={timeStart}
                  onChange={(event) => setTimeStart(event.target.value)}
                />
              </label>
              <label className="block text-sm">
                <span>Ends</span>
                <input
                  type="time"
                  className="mt-1.5 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
                  value={timeEnd}
                  onChange={(event) => setTimeEnd(event.target.value)}
                />
              </label>
            </div>
            <PendingButton type="button" variant="secondary" onClick={addCandidate}>
              Add this time
            </PendingButton>
          </div>
        </section>
      ) : null}

      {step === "place" ? (
        <section className="space-y-4">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Place</h2>
          <label className="block text-sm font-medium text-zinc-800 dark:text-zinc-200">
            <span>Proposed place (optional)</span>
            <input
              className="mt-1.5 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
              value={draft.location}
              placeholder="e.g. Central Park picnic area"
              onChange={(event) =>
                setDraft((current) => ({ ...current, location: event.target.value }))
              }
            />
          </label>
          <p className="text-xs text-zinc-600 dark:text-zinc-400">
            This is the event place, not a member&apos;s home address. Hosting is coordinated
            separately.
          </p>
          <label className="block text-sm font-medium text-zinc-800 dark:text-zinc-200">
            <span>Notes for the group (optional)</span>
            <textarea
              rows={3}
              className="mt-1.5 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
              value={draft.notes}
              onChange={(event) =>
                setDraft((current) => ({ ...current, notes: event.target.value }))
              }
            />
          </label>
        </section>
      ) : null}

      {step === "bring" ? (
        <section className="space-y-4">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
            What to bring
          </h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            After the event is confirmed, the group coordinates contributions using these
            categories. You do not need to assign everything now.
          </p>
          {activeCategories.length > 0 ? (
            <ul className="list-inside list-disc text-sm text-zinc-800 dark:text-zinc-200">
              {activeCategories.map((category) => (
                <li key={category.id}>
                  {category.name}
                  {category.followsHost ? " (follows host)" : ""}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              No contribution categories yet. Group admins can add categories from group settings.
            </p>
          )}
        </section>
      ) : null}

      {step === "review" ? (
        <section className="space-y-4">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Review</h2>
          {reviewMissing.length > 0 ? (
            <p className="text-sm text-red-600 dark:text-red-400" role="alert">
              Still needed: {reviewMissing.join(", ")}
            </p>
          ) : null}
          <dl className="grid gap-3 text-sm text-zinc-800 dark:text-zinc-200">
            <div>
              <dt className="text-zinc-500">Name</dt>
              <dd>{draft.title.trim() || "—"}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">Proposed times</dt>
              <dd>
                {draft.candidates.length > 0
                  ? draft.candidates.map((candidate) => (
                      <div key={`${candidate.startsAt}-${candidate.endsAt}`}>
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
              <dt className="text-zinc-500">Proposed place</dt>
              <dd>{draft.location.trim() || "Not specified"}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">Host</dt>
              <dd>{hostSummary(draft, members, isFirstGroupEvent, settings.hostingEnabled)}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">Contributions</dt>
              <dd>
                {activeCategories.length > 0
                  ? `${activeCategories.length} categories ready after confirmation`
                  : "None configured yet"}
              </dd>
            </div>
          </dl>
          {isFirstGroupEvent && settings.hostingEnabled ? (
            <label className="block text-sm font-medium text-zinc-800 dark:text-zinc-200">
              <span>Initial host (first gathering)</span>
              <p className="mt-1 text-xs font-normal text-zinc-600 dark:text-zinc-400">
                Your choice is a proposal — they still accept or ask to swap.
              </p>
              <select
                className="mt-1.5 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
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
              <p className="text-sm text-red-600 dark:text-red-400" role="alert">
                {actionState.error}
              </p>
            ) : null}
            <PendingButton
              type="submit"
              disabled={reviewMissing.length > 0}
              pendingLabel="Proposing…"
              className="w-full"
            >
              Propose event
            </PendingButton>
          </form>
        </section>
      ) : null}

      {stepError ? (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">{stepError}</p>
      ) : null}

      {step !== "review" ? (
        <div className="flex gap-3">
          {stepIndex > 0 ? (
            <PendingButton type="button" variant="secondary" onClick={goBack}>
              Back
            </PendingButton>
          ) : null}
          <PendingButton type="button" onClick={goNext} className="flex-1">
            Continue
          </PendingButton>
        </div>
      ) : (
        <PendingButton type="button" variant="secondary" onClick={goBack}>
          Back
        </PendingButton>
      )}
    </div>
  );
}
