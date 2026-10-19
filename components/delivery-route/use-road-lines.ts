"use client";

import { useEffect, useRef, useState } from "react";
import type { LngLat } from "@/lib/types";

const keyOf = (places: LngLat[]) => JSON.stringify(places);

/**
 * The van's lines along the roads, when the server has a routing service.
 * Until one arrives, and whenever it fails, the straight lines stand.
 */
export function useRoadLines(
  lines: { driven: LngLat[]; ahead: LngLat[] },
  enabled: boolean,
): { driven: LngLat[]; ahead: LngLat[] } {
  // Ways already fetched, by the places they go through.
  const roads = useRef(new Map<string, LngLat[]>());
  const [, setFetched] = useState(0);
  const { driven, ahead } = lines;

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    for (const places of [driven, ahead]) {
      const key = keyOf(places);
      if (places.length < 2 || roads.current.has(key)) continue;
      fetch("/api/route-geometry", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ coordinates: places }),
        signal: controller.signal,
      })
        .then((response) => (response.ok ? response.json() : null))
        .then((data: { coordinates?: LngLat[] } | null) => {
          if (!data?.coordinates || data.coordinates.length < 2) return;
          roads.current.set(key, data.coordinates);
          setFetched((count) => count + 1);
        })
        .catch(() => {
          // Straight lines it is.
        });
    }
    return () => controller.abort();
  }, [enabled, driven, ahead]);

  return {
    driven: roads.current.get(keyOf(driven)) ?? driven,
    ahead: roads.current.get(keyOf(ahead)) ?? ahead,
  };
}
