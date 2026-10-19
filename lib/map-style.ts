import type { MapStyle } from "@nuvui/map";

export const defaultTileUrl = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const osmAttribution =
  '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

/**
 * A MapLibre style for raster tiles from `MAP_TILE_URL`: an XYZ template
 * such as OpenStreetMap's. A URL that ends in .json is taken as a full
 * MapLibre style from a vector provider, and used as it is.
 */
export function mapStyleFor(tileUrl: string | undefined, attribution?: string): MapStyle {
  const url = tileUrl?.trim() || defaultTileUrl;
  if (/\.json(\?|$)/.test(url)) return url;
  return {
    version: 8,
    sources: {
      tiles: {
        type: "raster",
        tiles: [url],
        tileSize: 256,
        maxzoom: 19,
        attribution: attribution ?? osmAttribution,
      },
    },
    layers: [{ id: "tiles", type: "raster", source: "tiles" }],
  };
}
