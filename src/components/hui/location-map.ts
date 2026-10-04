/**
 * Deterministic, lightweight "topographic map" geometry for the location panel.
 * The same place name always draws the same map. No map SDK, no network, no coordinates.
 */

export function hashSeed(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function createRandom(seed: number): () => number {
  let state = seed || 1;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Pt = { x: number; y: number };

/** Smooth closed organic loop (Catmull-Rom converted to cubic beziers). */
export function blobPath(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  random: () => number,
  points = 8,
  wobble = 0.28,
): string {
  const pts: Pt[] = [];
  for (let i = 0; i < points; i += 1) {
    const angle = (2 * Math.PI * i) / points;
    const k = 1 - wobble + random() * wobble * 2;
    pts.push({ x: cx + Math.cos(angle) * rx * k, y: cy + Math.sin(angle) * ry * k });
  }
  const n = pts.length;
  let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 0; i < n; i += 1) {
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const p3 = pts[(i + 2) % n];
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
    d += ` C ${c1.x.toFixed(1)} ${c1.y.toFixed(1)}, ${c2.x.toFixed(1)} ${c2.y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return `${d} Z`;
}

export type MapScene = {
  width: number;
  height: number;
  pin: Pt;
  river: string;
  parks: string[];
  blocks: { x: number; y: number; w: number; h: number; rotate: number }[];
  roads: string[];
  contours: string[];
};

export const MAP_WIDTH = 400;
export const MAP_HEIGHT = 220;

export function buildMapScene(seedText: string): MapScene {
  const random = createRandom(hashSeed(seedText || "hui"));
  const pin: Pt = {
    x: MAP_WIDTH * (0.42 + random() * 0.16),
    y: MAP_HEIGHT * (0.4 + random() * 0.1),
  };

  const flip = random() > 0.5;
  const y0 = MAP_HEIGHT * (0.62 + random() * 0.18);
  const y1 = MAP_HEIGHT * (0.2 + random() * 0.2);
  const y2 = MAP_HEIGHT * (0.55 + random() * 0.25);
  const river = flip
    ? `M -10 ${y0.toFixed(1)} C ${MAP_WIDTH * 0.25} ${y1.toFixed(1)}, ${MAP_WIDTH * 0.6} ${(y2 + 40).toFixed(1)}, ${MAP_WIDTH + 10} ${y1.toFixed(1)}`
    : `M -10 ${y1.toFixed(1)} C ${MAP_WIDTH * 0.3} ${(y0 + 30).toFixed(1)}, ${MAP_WIDTH * 0.65} ${y1.toFixed(1)}, ${MAP_WIDTH + 10} ${y0.toFixed(1)}`;

  const parks = [
    blobPath(
      MAP_WIDTH * (flip ? 0.16 : 0.82),
      MAP_HEIGHT * (0.28 + random() * 0.12),
      52 + random() * 24,
      34 + random() * 12,
      random,
    ),
    blobPath(
      MAP_WIDTH * (flip ? 0.84 : 0.2),
      MAP_HEIGHT * (0.78 + random() * 0.1),
      36 + random() * 20,
      22 + random() * 10,
      random,
    ),
  ];

  const blocks = Array.from({ length: 9 }, () => ({
    x: random() * (MAP_WIDTH - 40),
    y: random() * (MAP_HEIGHT - 28),
    w: 26 + random() * 40,
    h: 16 + random() * 26,
    rotate: -14 + random() * 28,
  }));

  const roads = [
    `M -10 ${(MAP_HEIGHT * (0.3 + random() * 0.2)).toFixed(1)} Q ${MAP_WIDTH * 0.4} ${(MAP_HEIGHT * random()).toFixed(1)}, ${MAP_WIDTH + 10} ${(MAP_HEIGHT * (0.35 + random() * 0.3)).toFixed(1)}`,
    `M ${(MAP_WIDTH * (0.2 + random() * 0.2)).toFixed(1)} -10 Q ${(MAP_WIDTH * random()).toFixed(1)} ${MAP_HEIGHT * 0.5} ${(MAP_WIDTH * (0.5 + random() * 0.3)).toFixed(1)} ${MAP_HEIGHT + 10}`,
    `M ${pin.x.toFixed(1)} ${pin.y.toFixed(1)} Q ${(pin.x + 60).toFixed(1)} ${(pin.y + 30 - random() * 60).toFixed(1)}, ${MAP_WIDTH + 10} ${(MAP_HEIGHT * random()).toFixed(1)}`,
  ];

  const contours = [28, 52, 80].map((radius, index) =>
    blobPath(pin.x, pin.y, radius * 1.35, radius, random, 9, 0.12 + index * 0.05),
  );

  return { width: MAP_WIDTH, height: MAP_HEIGHT, pin, river, parks, blocks, roads, contours };
}
