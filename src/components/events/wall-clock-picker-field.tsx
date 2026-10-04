"use client";

import { useId } from "react";

import {
  formatWallClockDateLabel,
  formatWallClockTimeLabel,
} from "@/domain/datetime/wall-clock-display";

const fieldShellClass =
  "flex min-h-11 w-full items-center rounded-lg border border-zinc-300 bg-white px-3 py-2 text-base text-zinc-900 shadow-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50";

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
    <div className="block text-sm font-medium text-zinc-800 dark:text-zinc-200">
      <span id={labelId}>{label}</span>
      <div className="relative mt-1.5">
        <div aria-hidden className={`pointer-events-none ${fieldShellClass}`}>
          {display ? (
            <span>{display}</span>
          ) : (
            <span className="text-zinc-500 dark:text-zinc-400">{emptyHint}</span>
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
}: WallClockTimeFieldProps) {
  const labelId = useId();
  const display = formatWallClockTimeLabel(value) ?? (value ? value : null);

  return (
    <div className="block text-sm font-medium text-zinc-800 dark:text-zinc-200">
      <span id={labelId}>{label}</span>
      <div className="relative mt-1.5">
        <div aria-hidden className={`pointer-events-none ${fieldShellClass}`}>
          {display ? (
            <span>{display}</span>
          ) : (
            <span className="text-zinc-500 dark:text-zinc-400">{emptyHint}</span>
          )}
        </div>
        <input
          type="time"
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
