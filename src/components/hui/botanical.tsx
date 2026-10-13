import { cn } from "@/lib/ui/cn";

type Leaf = { x: number; y: number; rotate: number; scale: number; tone: 0 | 1 | 2 };

const STEM = { x0: 6, y0: 214, cx: 34, cy: 70, x1: 188, y1: 14 };

function pointOnStem(t: number) {
  const mt = 1 - t;
  const x = mt * mt * STEM.x0 + 2 * mt * t * STEM.cx + t * t * STEM.x1;
  const y = mt * mt * STEM.y0 + 2 * mt * t * STEM.cy + t * t * STEM.y1;
  const dx = 2 * mt * (STEM.cx - STEM.x0) + 2 * t * (STEM.x1 - STEM.cx);
  const dy = 2 * mt * (STEM.cy - STEM.y0) + 2 * t * (STEM.y1 - STEM.cy);
  return { x, y, angle: (Math.atan2(dy, dx) * 180) / Math.PI };
}

const LEAVES: Leaf[] = Array.from({ length: 11 }, (_, index) => {
  const t = 0.12 + index * 0.082;
  const { x, y, angle } = pointOnStem(t);
  const side = index % 2 === 0 ? -1 : 1;
  return {
    x,
    y,
    rotate: angle + side * (48 + (index % 3) * 6),
    scale: 0.75 + ((index * 37) % 10) / 22,
    tone: (index % 3) as 0 | 1 | 2,
  };
});

const LEAF_PATH = "M0 0 C 8 -13, 30 -15, 44 0 C 30 15, 8 13, 0 0 Z";

function Sprig({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 220 230"
      className={className}
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d={`M${STEM.x0} ${STEM.y0} Q${STEM.cx} ${STEM.cy} ${STEM.x1} ${STEM.y1}`}
        stroke="var(--accent-sage)"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      {LEAVES.map((leaf, index) => (
        <path
          key={index}
          d={LEAF_PATH}
          transform={`translate(${leaf.x.toFixed(1)} ${leaf.y.toFixed(1)}) rotate(${leaf.rotate.toFixed(1)}) scale(${leaf.scale.toFixed(2)})`}
          fill={
            leaf.tone === 0
              ? "var(--accent-sage)"
              : leaf.tone === 1
                ? "var(--accent-clay)"
                : "color-mix(in srgb, var(--accent-sage) 60%, var(--accent-primary))"
          }
          opacity={leaf.tone === 1 ? 0.55 : 0.7}
        />
      ))}
    </svg>
  );
}

/** Soft watercolour-style leaf sprigs tucked into the canvas corners (decorative only). */
export function HuiBotanical({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none fixed inset-0 z-0 overflow-hidden",
        className,
      )}
      style={{ opacity: "var(--leaf-opacity)" }}
    >
      <Sprig className="absolute -right-10 -top-8 h-56 w-56 rotate-[8deg] sm:-right-6 sm:h-72 sm:w-72" />
      <Sprig className="absolute -bottom-16 -left-14 h-60 w-60 rotate-[198deg] sm:-left-8 sm:h-80 sm:w-80" />
    </div>
  );
}
