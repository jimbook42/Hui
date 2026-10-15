"use client";

import { cn } from "@/lib/ui/cn";
import {
  EVENT_CONFIRM_RULES,
  type EventConfirmRule,
  eventConfirmRuleLabel,
  eventConfirmRuleOptionDescription,
} from "@/domain/events/confirm-rule";

type EventConfirmRuleFieldProps = {
  name?: string;
  value: EventConfirmRule;
  onChange: (rule: EventConfirmRule) => void;
  disabled?: boolean;
};

export function EventConfirmRuleField({
  name = "confirm_rule",
  value,
  onChange,
  disabled = false,
}: EventConfirmRuleFieldProps) {
  return (
    <fieldset className="space-y-3" disabled={disabled}>
      <legend className="hui-type-label text-muted-foreground">When should this hui confirm?</legend>
      <div className="space-y-2">
        {EVENT_CONFIRM_RULES.map((rule) => {
          const selected = value === rule;
          return (
            <label
              key={rule}
              className={cn(
                "hui-focus-ring flex cursor-pointer flex-col gap-1 rounded-hui-lg border px-4 py-3",
                selected
                  ? "border-2 border-primary bg-sage-soft"
                  : "border-transparent bg-muted",
                disabled && "cursor-not-allowed opacity-60",
              )}
            >
              <span className="flex items-center gap-2 text-sm font-extrabold text-foreground">
                <input
                  type="radio"
                  name={name}
                  className="sr-only"
                  value={rule}
                  checked={selected}
                  disabled={disabled}
                  onChange={() => onChange(rule)}
                />
                {eventConfirmRuleLabel(rule)}
              </span>
              <span className="text-xs font-semibold text-muted-foreground">
                {eventConfirmRuleOptionDescription(rule)}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

export function EventConfirmRuleDisplay({ rule }: { rule: EventConfirmRule }) {
  return (
    <p className="text-sm font-semibold text-muted-foreground">
      {eventConfirmRuleLabel(rule)}
    </p>
  );
}
