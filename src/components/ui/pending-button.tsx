"use client";

import { useFormStatus } from "react-dom";

type PendingButtonProps = {
  type?: "button" | "submit";
  onClick?: () => void;
  disabled?: boolean;
  pendingLabel?: string;
  children: React.ReactNode;
  className?: string;
  variant?: "primary" | "secondary";
};

const baseClass =
  "rounded-lg px-4 py-2.5 text-sm font-medium transition active:scale-[0.98] disabled:opacity-60 disabled:active:scale-100";

const variants = {
  primary:
    "bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200",
  secondary:
    "border border-zinc-300 bg-white text-zinc-900 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:hover:bg-zinc-900",
};

export function PendingButton({
  type = "button",
  onClick,
  disabled = false,
  pendingLabel = "Working…",
  children,
  className = "",
  variant = "primary",
}: PendingButtonProps) {
  const { pending } = useFormStatus();
  const isBusy = pending || disabled;

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={isBusy}
      aria-busy={pending || undefined}
      className={`${baseClass} ${variants[variant]} ${className}`}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
