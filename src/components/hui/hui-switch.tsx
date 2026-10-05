"use client";

import { cn } from "@/lib/ui/cn";

type HuiSwitchProps = {
  name?: string;
  checked?: boolean;
  defaultChecked?: boolean;
  disabled?: boolean;
  onChange?: (checked: boolean) => void;
  "aria-label"?: string;
  className?: string;
};

/**
 * Boolean control styled as a switch. Uses a native checkbox so server actions keep working.
 */
export function HuiSwitch({
  name,
  checked,
  defaultChecked,
  disabled,
  onChange,
  "aria-label": ariaLabel,
  className,
}: HuiSwitchProps) {
  const controlled = typeof checked === "boolean";

  return (
    <input
      type="checkbox"
      role="switch"
      name={name}
      aria-label={ariaLabel}
      disabled={disabled}
      className={cn("hui-switch", className)}
      checked={controlled ? checked : undefined}
      defaultChecked={controlled ? undefined : defaultChecked}
      onChange={
        onChange
          ? (event) => {
              onChange(event.target.checked);
            }
          : undefined
      }
    />
  );
}

type HuiSwitchFieldProps = {
  name?: string;
  label: string;
  description?: string;
  checked?: boolean;
  defaultChecked?: boolean;
  disabled?: boolean;
  onCheckedChange?: (checked: boolean) => void;
};

export function HuiSwitchField({
  name,
  label,
  description,
  checked,
  defaultChecked,
  disabled,
  onCheckedChange,
}: HuiSwitchFieldProps) {
  const controlled = typeof checked === "boolean";

  return (
    <label
      className={cn(
        "flex min-w-0 cursor-pointer items-start justify-between gap-4 rounded-hui-lg bg-surface p-4 hui-shadow-sm",
        disabled && "cursor-not-allowed opacity-60",
      )}
    >
      <span className="min-w-0 [text-wrap:pretty]">
        <span className="block text-sm font-extrabold text-foreground">{label}</span>
        {description ? (
          <span className="mt-1 block text-xs font-semibold text-muted-foreground">{description}</span>
        ) : null}
      </span>
      <HuiSwitch
        name={name}
        aria-label={label}
        disabled={disabled}
        checked={controlled ? checked : undefined}
        defaultChecked={controlled ? undefined : defaultChecked}
        onChange={onCheckedChange}
        className="mt-0.5 shrink-0"
      />
    </label>
  );
}
