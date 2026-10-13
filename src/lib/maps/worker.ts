/**
 * MapLibre GL JS 6 runs tile parsing in a module worker that must be served as a real file
 * (it imports its shared chunk by relative path), so bundlers cannot inline it.
 * `scripts/copy-maplibre-worker.mjs` copies it from node_modules into `public/vendor/maplibre-gl/`
 * on install/dev/build; this is the URL it is served from.
 */
export const MAPLIBRE_WORKER_URL = "/vendor/maplibre-gl/maplibre-gl-worker.mjs";
