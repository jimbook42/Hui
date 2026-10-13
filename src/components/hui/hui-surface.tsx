import type { CSSProperties, ElementType, ReactNode } from "react";

import { cn } from "@/lib/ui/cn";

export type HuiSurfaceTone = "default" | "subtle" | "blue" | "clay" | "sage" | "primary";
export type HuiSurfaceShape = "round" | "organic" | "organic-alt" | "soft";

type HuiSurfaceProps = {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  /** Soft card shadow. Defaults to on for default/tinted surfaces. */
  elevated?: boolean;
  padding?: "none" | "sm" | "md" | "lg";
  tone?: HuiSurfaceTone;
  shape?: HuiSurfaceShape;
  as?: ElementType;
  id?: string;
  role?: string;
};

const paddingClass = {
  none: "",
  sm: "p-4",
  md: "p-5",
  lg: "p-6 sm:p-7",
};

const toneClass: Record<HuiSurfaceTone, string> = {
  default: "bg-surface text-foreground",
  subtle: "bg-muted text-foreground",
  blue: "bg-blue-soft text-foreground",
  clay: "bg-clay-soft text-foreground",
  sage: "bg-sage-soft text-foreground",
  primary: "bg-primary text-primary-foreground",
};

const shapeClass: Record<HuiSurfaceShape, string> = {
  round: "rounded-hui-xl",
  organic: "hui-shape-organic",
  "organic-alt": "hui-shape-organic-alt",
  soft: "rounded-hui-lg",
};

/**
 * The primary Hui container: warm off-white, no hairline border, large organic radius
 * and a soft diffused lift from the canvas.
 */
export function HuiSurface({
  children,
  className,
  style,
  elevated,
  padding = "md",
  tone = "default",
  shape = "round",
  as: Component = "div",
  id,
  role,
}: HuiSurfaceProps) {
  const lifted = elevated ?? (tone === "default" || tone === "primary");

  return (
    <Component
      id={id}
      role={role}
      style={style}
      className={cn(
        "relative",
        shapeClass[shape],
        toneClass[tone],
        lifted && "hui-shadow-md",
        paddingClass[padding],
        className,
      )}
    >
      {children}
    </Component>
  );
}
