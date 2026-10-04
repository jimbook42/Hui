"use client";

import { useId } from "react";

import {
  formatWallClockDateLabel,
  formatWallClockTimeLabel,
} from "@/domain/datetime/wall-clock-display";

const fieldShellClass =
  "hui-input !mt-0 flex items-center";

const overlayInputClass =
  "absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0 text-base [color-scheme:light] dark:[color-scheme:dark]";

type WallClockDateFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  emptyHint?: string;
  min?: string;
  max?: string;
};

type WallClockTimeFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  emptyHint?: string;
  min?: string;
  max?: string;
  /** Show a Clear control so the field can go back to empty (optional times). */
  clearable?: boolean;
  clearLabel?: string;
};

function openNativePicker(input: HTMLInputElement | null) {
  if (!input) {
    return;
  }
  if (typeof input.showPicker === "function") {
    try {
      input.showPicker();
      return;
    } catch {
      // showPicker can throw if not user-gesture initiated; fall through.
    }
  }
  input.focus({ preventScroll: true });
  input.click();
}

export function WallClockDateField({
  label,
  value,
  onChange,
  emptyHint = "Choose a date",
  min,
  max,
}: WallClockDateFieldProps) {
  const labelId = useId();
  const display = formatWallClockDateLabel(value) ?? (value ? value : null);

  return (
    <div className="hui-label">
      <span id={labelId}>{label}</span>
      <div className="relative mt-1.5">
        <div aria-hidden className={`pointer-events-none ${fieldShellClass}`}>
          {display ? (
            <span>{display}</span>
          ) : (
            <span className="text-muted-foreground">{emptyHint}</span>
          )}
        </div>
        <input
          type="date"
          aria-labelledby={labelId}
          className={overlayInputClass}
          value={value}
          min={min}
          max={max}
          onChange={(event) => onChange(event.target.value)}
          onClick={(event) => {
            event.currentTarget.focus();
            openNativePicker(event.currentTarget);
          }}
        />
      </div>
    </div>
  );
}

export function WallClockTimeField({
  label,
  value,
  onChange,
  emptyHint = "Choose a time",
  min,
  max,
  clearable = false,
  clearLabel = "Clear",
}: WallClockTimeFieldProps) {
  const labelId = useId();
  const display = formatWallClockTimeLabel(value) ?? (value ? value : null);
  const showClear = clearable && value.length > 0;

  return (
    <div className="hui-label">
      <span id={labelId}>{label}</span>
      <div className="relative mt-1.5">
        <div aria-hidden className={`pointer-events-none ${fieldShellClass}`}>
          {display ? (
            <span>{display}</span>
          ) : (
            <span className="text-muted-foreground">{emptyHint}</span>
          )}
        </div>
        <input
          type="time"
          aria-labelledby={labelId}
          className={`${overlayInputClass}${showClear ? " !w-[calc(100%-4.5rem)]" : ""}`}
          value={value}
          min={min}
          max={max}
          onChange={(event) => onChange(event.target.value)}
          onClick={(event) => {
            event.currentTarget.focus();
            openNativePicker(event.currentTarget);
          }}
        />
        {showClear ? (
          <button
            type="button"
            onClick={() => onChange("")}
            className="hui-focus-ring absolute inset-y-1 right-1 z-20 inline-flex min-w-11 items-center justify-center rounded-full bg-muted px-3 text-xs font-extrabold text-foreground"
          >
            {clearLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
}
