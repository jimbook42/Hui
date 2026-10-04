import Link from "next/link";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/ui/cn";

export type HuiButtonVariant = "primary" | "secondary" | "soft" | "ghost" | "destructive";
export type HuiButtonSize = "default" | "sm" | "lg" | "touch";
export type HuiButtonShape = "pill" | "melt";

const variantClass: Record<HuiButtonVariant, string> = {
  primary: "hui-btn-primary",
  secondary: "hui-btn-secondary",
  soft: "hui-btn-soft",
  ghost: "hui-btn-ghost",
  destructive: "hui-btn-danger",
};

const sizeClass: Record<HuiButtonSize, string> = {
  sm: "hui-btn-sm",
  default: "",
  lg: "hui-btn-lg",
  touch: "hui-btn-lg w-full",
};

/** Shared class builder so links, form buttons and client buttons look identical. */
export function huiButtonClass({
  variant = "primary",
  size = "default",
  shape = "pill",
  className,
}: {
  variant?: HuiButtonVariant;
  size?: HuiButtonSize;
  shape?: HuiButtonShape;
  className?: string;
} = {}): string {
  return cn(
    "hui-btn hui-focus-ring",
    shape === "melt" ? "hui-shape-melt" : "rounded-full",
    variantClass[variant],
    sizeClass[size],
    className,
  );
}

type HuiButtonProps = {
  variant?: HuiButtonVariant;
  size?: HuiButtonSize;
  shape?: HuiButtonShape;
  className?: string;
  type?: "button" | "submit" | "reset";
  disabled?: boolean;
  children: ReactNode;
} & ButtonHTMLAttributes<HTMLButtonElement>;

export function HuiButton({
  variant = "primary",
  size = "default",
  shape = "pill",
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
      className={huiButtonClass({ variant, size, shape, className })}
      {...rest}
    >
      {children}
    </button>
  );
}

type HuiLinkButtonProps = {
  href: string;
  variant?: HuiButtonVariant;
  size?: HuiButtonSize;
  shape?: HuiButtonShape;
  className?: string;
  children: ReactNode;
} & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href" | "className">;

export function HuiLinkButton({
  href,
  variant = "primary",
  size = "default",
  shape = "pill",
  className,
  children,
  ...rest
}: HuiLinkButtonProps) {
  return (
    <Link
      href={href}
      className={huiButtonClass({ variant, size, shape, className })}
      {...rest}
    >
      {children}
    </Link>
  );
}
