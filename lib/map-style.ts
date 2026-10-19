import type { MapStyle } from "@nuvui/map";

export const defaultTileUrl = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const osmAttribution =
  '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

// The map writes the attribution as HTML. Keep its text and plain https
// links, and nothing else.
function safeAttribution(html: string): string {
  return html.replace(/<(?!\/?a(?=[\s>]))[^>]*>/gi, "").replace(/<a\b[^>]*>/gi, (tag) => {
    const href = /href\s*=\s*"(https:\/\/[^"]*)"/i.exec(tag)?.[1];
    return href ? `<a href="${href}" rel="noopener noreferrer">` : "<a>";
  });
}

function parseUrl(value: string): URL | undefined {
  try {
    // The braces of an XYZ template aren't valid in a URL, so stand in for them.
    const url = new URL(value.replaceAll(/\{[xyz]\}/g, "0"));
    return url.protocol === "https:" || url.protocol === "http:" ? url : undefined;
  } catch {
    return undefined;
  }
}

/**
 * A MapLibre style from `MAP_TILE_URL`. An XYZ template, such as
 * OpenStreetMap's, is drawn as raster tiles. An address whose path ends in
 * .json is a full MapLibre style from a vector provider, and used as it is.
 * Anything else falls back to OpenStreetMap.
 */
export function mapStyleFor(tileUrl: string | undefined, attribution?: string): MapStyle {
  const value = tileUrl?.trim() ?? "";
  const url = value ? parseUrl(value) : undefined;
  if (url?.pathname.endsWith(".json")) return value;
  const isTemplate =
    url !== undefined && ["{z}", "{x}", "{y}"].every((part) => value.includes(part));
  const tiles = isTemplate ? value : defaultTileUrl;
  return {
    version: 8,
    sources: {
      tiles: {
        type: "raster",
        tiles: [tiles],
        tileSize: 256,
        maxzoom: 19,
        attribution: safeAttribution(attribution?.trim() || osmAttribution),
      },
    },
    layers: [{ id: "tiles", type: "raster", source: "tiles" }],
  };
}
