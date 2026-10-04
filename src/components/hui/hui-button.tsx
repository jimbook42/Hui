import type { ButtonHTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/ui/cn";

type HuiButtonVariant = "primary" | "secondary" | "ghost" | "destructive";
type HuiButtonSize = "default" | "sm" | "lg" | "touch";

const variantClass: Record<HuiButtonVariant, string> = {
  primary:
    "rounded-full bg-primary text-primary-foreground hui-shadow-sm hover:bg-primary-hover active:scale-[0.98]",
  secondary:
    "border border-border bg-surface text-foreground hover:bg-muted active:scale-[0.98]",
  ghost: "text-foreground hover:bg-muted active:scale-[0.98]",
  destructive:
    "bg-destructive text-destructive-foreground hover:opacity-90 active:scale-[0.98]",
};

const sizeClass: Record<HuiButtonSize, string> = {
  sm: "rounded-hui-sm px-3 py-1.5 text-xs font-medium",
  default: "rounded-hui-md px-4 py-2.5 text-sm font-medium",
  lg: "rounded-hui-lg px-5 py-3 text-sm font-medium",
  touch: "rounded-hui-xl px-4 py-3.5 text-sm font-medium min-h-11 w-full",
};

type HuiButtonProps = {
  variant?: HuiButtonVariant;
  size?: HuiButtonSize;
  className?: string;
  type?: "button" | "submit" | "reset";
  disabled?: boolean;
  children: ReactNode;
} & ButtonHTMLAttributes<HTMLButtonElement>;

export function HuiButton({
  variant = "primary",
  size = "default",
  className,
  type = "button",
  disabled,
  children,
  ...rest
}: HuiButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled}
      className={cn(
        "hui-focus-ring inline-flex items-center justify-center transition disabled:opacity-60 disabled:active:scale-100",
        variantClass[variant],
        sizeClass[size],
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
