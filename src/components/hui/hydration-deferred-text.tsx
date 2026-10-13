"use client";

import { useEffect, useState } from "react";

type HydrationClientOnlyTextProps = {
  compute: () => string;
  className?: string;
};

/** Renders nothing until after mount — avoids SSR/client text drift for time-sensitive labels. */
export function HydrationClientOnlyText({ compute, className }: HydrationClientOnlyTextProps) {
  const [text, setText] = useState<string | null>(null);
  useEffect(() => {
    const id = window.requestAnimationFrame(() => setText(compute()));
    return () => window.cancelAnimationFrame(id);
  }, [compute]);
  if (!text) {
    return null;
  }
  return <span className={className}>{text}</span>;
}
