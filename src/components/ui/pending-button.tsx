"use client";

import { useFormStatus } from "react-dom";

import { huiButtonClass } from "@/components/hui/hui-button";

type PendingButtonProps = {
  type?: "button" | "submit";
  onClick?: () => void;
  disabled?: boolean;
  pendingLabel?: string;
  children: React.ReactNode;
  className?: string;
  variant?: "primary" | "secondary" | "soft" | "destructive";
  size?: "default" | "sm" | "lg" | "touch";
};

export function PendingButton({
  type = "button",
  onClick,
  disabled = false,
  pendingLabel = "Working…",
  children,
  className = "",
  variant = "primary",
  size = "default",
}: PendingButtonProps) {
  const { pending } = useFormStatus();
  const isBusy = pending || disabled;

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={isBusy}
      aria-busy={pending || undefined}
      className={huiButtonClass({ variant, size, shape: "pill", className })}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
