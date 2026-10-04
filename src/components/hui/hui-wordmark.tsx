import Image from "next/image";

import { cn } from "@/lib/ui/cn";

const ASPECT = 320 / 196;

/** Forest-green wordmark (trimmed from the supplied brand asset); lightened in dark mode. */
export function HuiWordmark({
  className,
  height = 34,
  priority = false,
}: {
  className?: string;
  height?: number;
  priority?: boolean;
}) {
  return (
    <Image
      src="/brand/hui-wordmark-trim.png"
      alt="Hui"
      width={Math.round(height * ASPECT)}
      height={height}
      priority={priority}
      className={cn("w-auto dark:[filter:brightness(0)_invert(0.94)]", className)}
      style={{ height }}
    />
  );
}
