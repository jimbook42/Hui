import Image from "next/image";

import { cn } from "@/lib/ui/cn";

/**
 * The supplied Hui ring logo (three member-coloured nodes in a forest-green ring).
 *
 * The brand ships two versions: one drawn for light surfaces (dark green ring) and one for dark
 * surfaces (light ring). Both are the supplied artwork with the flat white / black background
 * lifted to transparency by `scripts/generate-icons.mjs`, so they sit on any tinted surface.
 */
export function HuiLogo({
  size = 96,
  priority = false,
  className,
}: {
  size?: number;
  priority?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn("relative inline-block shrink-0", className)}
      style={{ width: size, height: size }}
      role="img"
      aria-label="Hui"
    >
      <Image
        src="/brand/hui-logo-light.png"
        alt=""
        width={size}
        height={size}
        priority={priority}
        sizes={`${size}px`}
        className="absolute inset-0 h-full w-full object-contain dark:hidden"
      />
      <Image
        src="/brand/hui-logo-dark.png"
        alt=""
        width={size}
        height={size}
        priority={priority}
        sizes={`${size}px`}
        className="absolute inset-0 hidden h-full w-full object-contain dark:block"
      />
    </span>
  );
}
