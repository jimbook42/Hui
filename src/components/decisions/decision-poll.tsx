"use client";

import { useState, useTransition } from "react";

import {
  cancelEventDecisionAction,
  finalizeEventDecisionAction,
  respondEventDecisionAction,
} from "@/app/decisions/actions";
import { HuiButton } from "@/components/hui/hui-button";
import { CheckIcon } from "@/components/hui/icons";
import { formatShortDay } from "@/domain/datetime/display";
import type { DecisionPollView } from "@/domain/decisions/display";
import { cn } from "@/lib/ui/cn";

type DecisionPollProps = {
  poll: DecisionPollView;
  eventId: string;
  canManage: boolean;
  canRespond: boolean;
  timeZone: string;
  compact?: boolean;
};

export function DecisionPoll({
  poll,
  eventId,
  canManage,
  canRespond,
  timeZone,
  compact = false,
}: DecisionPollProps) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [finalizeOptionId, setFinalizeOptionId] = useState<string | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);

  function respond(optionId: string) {
    setError(null);
    startTransition(async () => {
      const result = await respondEventDecisionAction(poll.id, optionId, eventId);
      if (result.error) {
        setError(result.error);
      }
    });
  }

  function finalize() {
    if (!finalizeOptionId) {
      setError("Choose which option the group decided on.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await finalizeEventDecisionAction(poll.id, finalizeOptionId, eventId);
      if (result.error) {
        setError(result.error);
      } else {
        setFinalizeOptionId(null);
      }
    });
  }

  function cancelDecision() {
    setError(null);
    startTransition(async () => {
      const result = await cancelEventDecisionAction(poll.id, eventId);
      if (result.error) {
        setError(result.error);
      } else {
        setCancelOpen(false);
      }
    });
  }

  const decided = poll.status === "decided";
  const cancelled = poll.status === "cancelled";
  const open = poll.status === "open";

  return (
    <article
      className={cn(
        "rounded-hui-lg border border-border/60 bg-surface/50",
        compact ? "p-4" : "p-5",
      )}
      aria-labelledby={`decision-${poll.id}-question`}
    >
      <h3
        id={`decision-${poll.id}-question`}
        className={cn("font-extrabold text-foreground", compact ? "text-base" : "text-lg")}
      >
        {poll.question}
      </h3>

      {cancelled ? (
        <p className="mt-2 text-sm font-semibold text-muted-foreground">Cancelled — no longer asking for answers.</p>
      ) : null}

      {decided && poll.selectedLabel ? (
        <div className="mt-3 flex items-start gap-2 text-foreground">
          <CheckIcon size={20} className="mt-0.5 shrink-0 text-accent" strokeWidth={3} />
          <div>
            <p className="font-extrabold">{poll.selectedLabel}</p>
            {poll.decidedByName && poll.decidedAt ? (
              <p className="mt-0.5 text-sm font-semibold text-muted-foreground">
                Decided by {poll.decidedByName} · {formatShortDay(poll.decidedAt, timeZone)}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      {open ? (
        <>
          <ul className="mt-4 space-y-2" role="list">
            {poll.options.map((option) => {
              const isViewerChoice = poll.viewerOptionId === option.id;
              const showTally = poll.responseCount > 0;
              return (
                <li key={option.id}>
                  {canRespond ? (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => respond(option.id)}
                      className={cn(
                        "flex w-full items-center justify-between gap-3 rounded-hui-md border px-4 py-3 text-left transition-colors hui-focus-ring",
                        isViewerChoice
                          ? "border-accent bg-clay-soft font-extrabold text-foreground"
                          : "border-border/70 bg-surface font-semibold text-foreground hover:border-accent/40",
                      )}
                      aria-pressed={isViewerChoice}
                    >
                      <span className="min-w-0">{option.label}</span>
                      {showTally ? (
                        <span className="shrink-0 text-sm font-extrabold text-muted-foreground">
                          {option.count}
                        </span>
                      ) : null}
                    </button>
                  ) : (
                    <div
                      className="flex items-center justify-between gap-3 rounded-hui-md border border-border/50 px-4 py-3 text-sm font-semibold text-foreground"
                    >
                      <span>{option.label}</span>
                      {showTally ? <span className="font-extrabold text-muted-foreground">{option.count}</span> : null}
                    </div>
                  )}
                  {option.voters.length > 0 ? (
                    <p className="mt-1 px-1 text-xs font-semibold text-muted-foreground">
                      {option.voters.map((voter) => voter.displayName).join(", ")}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>

          <p className="mt-3 text-sm font-semibold text-muted-foreground">
            {poll.responseCount} of {poll.eligibleCount} responded
            {poll.viewerOptionId ? " · You have answered" : canRespond ? " · Tap your choice" : null}
          </p>

          {canManage ? (
            <div className="mt-4 space-y-3 border-t border-border/60 pt-4">
              <p className="hui-type-label text-muted-foreground">Record the group&apos;s decision</p>
              <div className="flex flex-wrap gap-2">
                {poll.options.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    disabled={pending}
                    onClick={() => setFinalizeOptionId(option.id)}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-sm font-bold hui-focus-ring",
                      finalizeOptionId === option.id
                        ? "border-accent bg-clay-soft text-foreground"
                        : "border-border text-muted-foreground",
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <HuiButton
                type="button"
                size="sm"
                disabled={pending || !finalizeOptionId}
                onClick={finalize}
              >
                {pending ? "Saving…" : "Decide result"}
              </HuiButton>
            </div>
          ) : null}

          {canManage && !cancelOpen ? (
            <button
              type="button"
              className="mt-4 text-sm font-bold text-destructive hui-focus-ring rounded-md"
              onClick={() => setCancelOpen(true)}
            >
              Cancel this decision
            </button>
          ) : null}

          {canManage && cancelOpen ? (
            <div className="mt-4 space-y-3 rounded-hui-md border border-destructive/30 bg-destructive/5 p-4">
              <p className="text-sm font-extrabold text-foreground">Cancel this decision?</p>
              <p className="text-sm font-semibold text-muted-foreground">
                Members will no longer be asked to respond. It stays in the hui history as cancelled.
              </p>
              <div className="flex flex-wrap gap-2">
                <HuiButton
                  type="button"
                  variant="destructive"
                  size="sm"
                  disabled={pending}
                  onClick={cancelDecision}
                >
                  {pending ? "Cancelling…" : "Cancel decision"}
                </HuiButton>
                <HuiButton
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={pending}
                  onClick={() => setCancelOpen(false)}
                >
                  Keep open
                </HuiButton>
              </div>
            </div>
          ) : null}
        </>
      ) : null}

      {error ? (
        <p className="hui-message-error mt-3" role="alert">
          {error}
        </p>
      ) : null}
    </article>
  );
}
