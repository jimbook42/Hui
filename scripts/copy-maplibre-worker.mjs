import fs from "node:fs";
import path from "node:path";

// MapLibre GL JS 6 loads its tile worker as a standalone ES module file. Copy the worker and the
// shared chunk it imports into public/ so they are served same-origin (see src/lib/maps/worker.ts).
const root = path.resolve(import.meta.dirname, "..");
const source = path.join(root, "node_modules", "maplibre-gl", "dist");
const target = path.join(root, "public", "vendor", "maplibre-gl");

const files = ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"];

if (!fs.existsSync(source)) {
  console.warn("maplibre-gl is not installed; skipping worker copy.");
  process.exit(0);
}

fs.mkdirSync(target, { recursive: true });
for (const file of files) {
  fs.copyFileSync(path.join(source, file), path.join(target, file));
}

console.log(`Copied MapLibre worker assets to ${path.relative(root, target)}/`);
