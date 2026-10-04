import type { ReactNode } from "react";

import { PinIcon } from "@/components/hui/icons";
import { cn } from "@/lib/ui/cn";

/** Small deterministic PRNG so the same place name always draws the same map. */
function seeded(seedText: string): () => number {
  let h = 1779033703 ^ seedText.length;
  for (let i = 0; i < seedText.length; i += 1) {
    h = Math.imul(h ^ seedText.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let state = h >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const W = 400;
const H = 240;

function blob(cx: number, cy: number, rx: number, ry: number, rand: () => number): string {
  const points = 8;
  const coords: Array<[number, number]> = [];
  for (let i = 0; i < points; i += 1) {
    const angle = (Math.PI * 2 * i) / points;
    const jitter = 0.78 + rand() * 0.4;
    coords.push([cx + Math.cos(angle) * rx * jitter, cy + Math.sin(angle) * ry * jitter]);
  }
  const mid = (a: [number, number], b: [number, number]) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const start = mid(coords[points - 1], coords[0]);
  let d = `M${start[0].toFixed(1)} ${start[1].toFixed(1)}`;
  for (let i = 0; i < points; i += 1) {
    const next = coords[(i + 1) % points];
    const m = mid(coords[i], next);
    d += ` Q${coords[i][0].toFixed(1)} ${coords[i][1].toFixed(1)} ${m[0].toFixed(1)} ${m[1].toFixed(1)}`;
  }
  return `${d}Z`;
}

type MapGeometry = {
  blocks: Array<{ x: number; y: number; w: number; h: number; tone: number }>;
  river: string;
  roads: string[];
  parks: Array<{ d: string; trees: Array<[number, number]> }>;
  contours: string[];
  pin: { x: number; y: number };
};

export function buildMapGeometry(seedText: string): MapGeometry {
  const rand = seeded(seedText || "hui");

  const blocks: MapGeometry["blocks"] = [];
  for (let gx = 0; gx < 9; gx += 1) {
    for (let gy = 0; gy < 5; gy += 1) {
      if (rand() < 0.38) {
        continue;
      }
      blocks.push({
        x: gx * 48 - 8 + rand() * 8,
        y: gy * 52 - 6 + rand() * 8,
        w: 28 + rand() * 12,
        h: 30 + rand() * 12,
        tone: Math.floor(rand() * 2),
      });
    }
  }

  const riverY = 70 + rand() * 100;
  const wiggle = 30 + rand() * 40;
  const river = `M-20 ${riverY.toFixed(1)} C 70 ${(riverY - wiggle).toFixed(1)}, 130 ${(riverY + wiggle).toFixed(1)}, 210 ${(riverY + wiggle * 0.2).toFixed(1)} S 350 ${(riverY - wiggle * 0.8).toFixed(1)}, 430 ${(riverY + wiggle * 0.5).toFixed(1)}`;

  const roads = [
    `M-10 ${(30 + rand() * 40).toFixed(1)} Q 150 ${(60 + rand() * 60).toFixed(1)} 410 ${(20 + rand() * 60).toFixed(1)}`,
    `M-10 ${(170 + rand() * 50).toFixed(1)} Q 200 ${(130 + rand() * 60).toFixed(1)} 410 ${(180 + rand() * 40).toFixed(1)}`,
    `M${(60 + rand() * 80).toFixed(1)} -10 Q ${(90 + rand() * 60).toFixed(1)} 120 ${(40 + rand() * 120).toFixed(1)} 250`,
    `M${(250 + rand() * 100).toFixed(1)} -10 Q ${(240 + rand() * 80).toFixed(1)} 110 ${(280 + rand() * 90).toFixed(1)} 250`,
  ];

  const parks: MapGeometry["parks"] = [];
  const parkCount = 2 + Math.floor(rand() * 2);
  for (let i = 0; i < parkCount; i += 1) {
    const cx = 40 + rand() * 320;
    const cy = 30 + rand() * 180;
    const rx = 36 + rand() * 34;
    const ry = 22 + rand() * 24;
    const trees: Array<[number, number]> = Array.from({ length: 5 }, () => [
      cx + (rand() - 0.5) * rx * 1.3,
      cy + (rand() - 0.5) * ry * 1.3,
    ]);
    parks.push({ d: blob(cx, cy, rx, ry, rand), trees });
  }

  const hillX = 60 + rand() * 280;
  const hillY = 50 + rand() * 140;
  const contours = [20, 36, 54].map((r) => blob(hillX, hillY, r * 1.35, r, rand));

  const pin = { x: 170 + rand() * 60, y: 96 + rand() * 40 };

  return { blocks, river, roads, parks, contours, pin };
}

type LocationMapProps = {
  /** Place name — drives the deterministic map drawing. */
  location: string | null;
  className?: string;
  /** Overlay content (status pill, back chip, etc.). */
  children?: ReactNode;
  /** Show a label pill with the place name on the map. */
  showLabel?: boolean;
  pendingLabel?: string;
};

/**
 * Lightweight illustrated map of "where this hui is happening". Deterministic per place name,
 * no map SDK, no network, no live location — a mood piece, not navigation.
 */
export function LocationMap({
  location,
  className,
  children,
  showLabel = true,
  pendingLabel = "Place still being worked out",
}: LocationMapProps) {
  const place = location?.trim() ?? "";
  const geometry = buildMapGeometry(place || "hui-pending");
  const hasPlace = place.length > 0;

  return (
    <div className={cn("relative isolate overflow-hidden", className)}>
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
        focusable="false"
      >
        <rect width={W} height={H} fill="var(--map-land)" />
        {geometry.blocks.map((block, index) => (
          <rect
            key={index}
            x={block.x}
            y={block.y}
            width={block.w}
            height={block.h}
            rx="7"
            fill="var(--map-block)"
            opacity={block.tone === 0 ? 0.9 : 0.55}
          />
        ))}
        {geometry.contours.map((d, index) => (
          <path
            key={index}
            d={d}
            fill="none"
            stroke="var(--accent-sage)"
            strokeWidth="1.2"
            strokeDasharray="3 4"
            opacity={0.65 - index * 0.12}
          />
        ))}
        {geometry.roads.map((d, index) => (
          <path
            key={index}
            d={d}
            fill="none"
            stroke="var(--map-road)"
            strokeWidth={index < 2 ? 6 : 4}
            strokeLinecap="round"
          />
        ))}
        <path d={geometry.river} fill="none" stroke="var(--map-water)" strokeWidth="20" strokeLinecap="round" />
        <path
          d={geometry.river}
          fill="none"
          stroke="color-mix(in srgb, var(--map-water) 70%, var(--map-road))"
          strokeWidth="5"
          strokeLinecap="round"
          opacity="0.7"
        />
        {geometry.parks.map((park, index) => (
          <g key={index}>
            <path d={park.d} fill="var(--map-park)" opacity="0.92" />
            {park.trees.map(([tx, ty], treeIndex) => (
              <circle
                key={treeIndex}
                cx={tx}
                cy={ty}
                r="3.2"
                fill="color-mix(in srgb, var(--map-park) 55%, var(--accent-primary))"
                opacity="0.55"
              />
            ))}
          </g>
        ))}

        <g transform={`translate(${geometry.pin.x.toFixed(1)} ${geometry.pin.y.toFixed(1)})`}>
          <circle r="34" fill="var(--accent-primary)" opacity="0.1" />
          <circle r="20" fill="var(--accent-primary)" opacity="0.14" />
          <ellipse cx="0" cy="3" rx="9" ry="3.2" fill="#000" opacity="0.18" />
          <path
            d="M0 0 C -15 -17, -17 -29, -17 -35 A 17 17 0 1 1 17 -35 C 17 -29, 15 -17, 0 0 Z"
            transform="translate(0 -2)"
            fill={hasPlace ? "var(--accent-primary)" : "var(--accent-sage)"}
            stroke="var(--bg-surface)"
            strokeWidth="3"
            strokeLinejoin="round"
            strokeDasharray={hasPlace ? undefined : "5 4"}
          />
          <circle cx="0" cy="-37" r="6.5" fill="var(--bg-surface)" />
        </g>
      </svg>

      {showLabel ? (
        <div className="pointer-events-none absolute bottom-3 left-3 right-3 z-10 flex">
          <span className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-surface/95 px-3.5 py-2 text-sm font-extrabold text-foreground hui-shadow-sm backdrop-blur">
            <PinIcon size={16} className="shrink-0 text-accent" />
            <span className="truncate">{hasPlace ? place : pendingLabel}</span>
          </span>
        </div>
      ) : null}

      {children}
    </div>
  );
}

type EventLocationPanelProps = {
  location: string | null;
  className?: string;
  /** Hide entirely when no place has been set (default: show a gentle "still being worked out" map). */
  hideWhenEmpty?: boolean;
  title?: string;
};

/** Stand-alone location surface: illustrated map + the place spelled out in text. */
export function EventLocationPanel({
  location,
  className,
  hideWhenEmpty = false,
  title = "Where",
}: EventLocationPanelProps) {
  const place = location?.trim() ?? "";
  if (!place && hideWhenEmpty) {
    return null;
  }

  return (
    <div className={cn("overflow-hidden rounded-hui-xl bg-surface hui-shadow-md", className)}>
      <LocationMap location={location} showLabel={false} className="h-40" />
      <div className="px-5 py-4">
        <p className="hui-type-label text-muted-foreground">{title}</p>
        <p className="hui-type-body mt-1 font-bold text-foreground">
          {place || "Still being worked out"}
        </p>
      </div>
    </div>
  );
}
