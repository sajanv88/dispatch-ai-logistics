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
 * A MapLibre style from `MAP_TILE_URL`. An XYZ template with {z}, {x} and
 * {y}, such as OpenStreetMap's, is drawn as raster tiles. Any other address
 * is a full MapLibre style from a vector provider, such as OpenFreeMap's or
 * MapTiler's, and used as it is: the style carries its own attribution.
 * Nothing set, or an address that isn't http(s), falls back to OpenStreetMap.
 */
export function mapStyleFor(tileUrl: string | undefined, attribution?: string): MapStyle {
  const value = tileUrl?.trim() ?? "";
  const url = value ? parseUrl(value) : undefined;
  const isTemplate = ["{z}", "{x}", "{y}"].every((part) => value.includes(part));
  if (url && !isTemplate) return value;
  const tiles = url && isTemplate ? value : defaultTileUrl;
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
