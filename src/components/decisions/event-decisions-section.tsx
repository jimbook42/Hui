import { DecisionCreateForm } from "@/components/decisions/decision-create-form";
import { DecisionPoll } from "@/components/decisions/decision-poll";
import {
  buildDecisionPollView,
  type DecisionPollView,
} from "@/domain/decisions/display";
import type { EventDecisionBundle } from "@/lib/decisions/types";

type Member = { userId: string; displayName: string };

type EventDecisionsSectionProps = {
  eventId: string;
  bundles: EventDecisionBundle[];
  members: Member[];
  viewerUserId: string;
  canManage: boolean;
  canRespond: boolean;
  timeZone: string;
  showCreateForm?: boolean;
  compactOpenOnly?: boolean;
};

function memberName(members: Member[], userId: string | null): string | null {
  if (!userId) return null;
  return members.find((member) => member.userId === userId)?.displayName ?? null;
}

function toPollViews(
  bundles: EventDecisionBundle[],
  members: Member[],
  viewerUserId: string,
): DecisionPollView[] {
  return bundles.map((bundle) =>
    buildDecisionPollView({
      id: bundle.decision.id,
      question: bundle.decision.question,
      status: bundle.decision.status,
      options: bundle.options,
      responses: bundle.responses.map((row) => ({
        userId: row.userId,
        optionId: row.optionId,
      })),
      members,
      viewerUserId,
      selectedOptionId: bundle.decision.selectedOptionId,
      decidedByUserId: bundle.decision.decidedBy,
      decidedAt: bundle.decision.decidedAt,
      decidedByName: memberName(members, bundle.decision.decidedBy),
    }),
  );
}

export function EventDecisionsSection({
  eventId,
  bundles,
  members,
  viewerUserId,
  canManage,
  canRespond,
  timeZone,
  showCreateForm = false,
  compactOpenOnly = false,
}: EventDecisionsSectionProps) {
  const polls = toPollViews(bundles, members, viewerUserId);
  const openPolls = polls.filter((poll) => poll.status === "open");
  const historyPolls = polls.filter((poll) => poll.status !== "open");
  const visible = compactOpenOnly ? openPolls : openPolls;

  if (visible.length === 0 && historyPolls.length === 0 && !showCreateForm) {
    return null;
  }

  const editableDraft = showCreateForm
    ? polls.find((poll) => poll.status === "open" && poll.responseCount === 0)
    : null;

  return (
    <section id="decisions" className="hui-card-section space-y-4">
      {showCreateForm ? (
        <div className="space-y-3">
          <h3 className="hui-type-label text-muted-foreground">
            {editableDraft ? "Edit before anyone answers" : "New decision"}
          </h3>
          <DecisionCreateForm eventId={eventId} editPoll={editableDraft ?? null} />
        </div>
      ) : null}

      {visible.length > 0 ? (
        <ul className="space-y-4" role="list">
          {visible.map((poll) => (
            <li key={poll.id}>
              <DecisionPoll
                poll={poll}
                eventId={eventId}
                canManage={canManage}
                canRespond={canRespond}
                timeZone={timeZone}
                compact={compactOpenOnly}
              />
            </li>
          ))}
        </ul>
      ) : showCreateForm ? (
        <p className="text-sm font-semibold text-muted-foreground">No decisions yet for this hui.</p>
      ) : null}

      {!compactOpenOnly && historyPolls.length > 0 ? (
        <ul className="mt-6 space-y-4 border-t border-border/60 pt-6" role="list">
          {historyPolls.map((poll) => (
              <li key={poll.id}>
                <DecisionPoll
                  poll={poll}
                  eventId={eventId}
                  canManage={false}
                  canRespond={false}
                  timeZone={timeZone}
                />
              </li>
            ))}
        </ul>
      ) : null}
    </section>
  );
}
