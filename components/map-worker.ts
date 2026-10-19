"use client";

import { setMapWorkerUrl } from "@nuvui/map";

// MapLibre does its work in a file of its own, and has to be told where the
// bundler put it. Imported once by each component that draws a map.
setMapWorkerUrl(new URL("maplibre-gl/dist/maplibre-gl-worker.mjs", import.meta.url));
