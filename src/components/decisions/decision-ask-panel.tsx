"use client";

import { useState } from "react";

import { DecisionCreateForm } from "@/components/decisions/decision-create-form";
import { HuiButton } from "@/components/hui/hui-button";

type DecisionAskPanelProps = {
  eventId: string;
  /** Manage surface keeps the form visible without an extra tap. */
  showFormByDefault?: boolean;
};

export function DecisionAskPanel({ eventId, showFormByDefault = false }: DecisionAskPanelProps) {
  const [open, setOpen] = useState(showFormByDefault);

  if (!open) {
    return (
      <HuiButton type="button" size="sm" variant="secondary" onClick={() => setOpen(true)}>
        Ask the group
      </HuiButton>
    );
  }

  return (
    <div className="space-y-3">
      <DecisionCreateForm eventId={eventId} />
      {!showFormByDefault ? (
        <button
          type="button"
          className="text-sm font-bold text-muted-foreground hui-focus-ring rounded-md"
          onClick={() => setOpen(false)}
        >
          Cancel
        </button>
      ) : null}
    </div>
  );
}
