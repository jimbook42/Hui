"use client";

import { useFormStatus } from "react-dom";

import { cn } from "@/lib/ui/cn";

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
  "hui-focus-ring rounded-hui-md px-4 py-2.5 text-sm font-medium transition active:scale-[0.98] disabled:opacity-60 disabled:active:scale-100";

const variants = {
  primary:
    "rounded-full bg-primary text-primary-foreground hui-shadow-sm hover:bg-primary-hover",
  secondary:
    "border border-border bg-surface text-foreground hover:bg-muted",
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
      className={cn(baseClass, variants[variant], className)}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
