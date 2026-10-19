import { z } from "zod";
import { serverEnv } from "@/lib/env";
import { readJson } from "@/lib/http";
import { checkRouting, clientIp } from "@/lib/rate-limit";

// Optional: the way along the roads between stops, from an OSRM server at
// ROUTING_URL. Without it, or when it fails, the map draws straight lines.

const requestSchema = z.object({
  coordinates: z
    .array(z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]))
    .min(2)
    .max(50),
});

const osrmSchema = z.object({
  code: z.literal("Ok"),
  routes: z
    .array(
      z.object({
        geometry: z.object({ coordinates: z.array(z.tuple([z.number(), z.number()])) }),
      }),
    )
    .min(1),
});

export async function POST(request: Request) {
  const base = serverEnv().ROUTING_URL;
  if (!base) return new Response("Routing isn't configured.", { status: 404 });

  if (!(await checkRouting(clientIp(request)))) {
    return new Response("Too many routing requests. Try again later.", { status: 429 });
  }
  const read = await readJson(request, 8 * 1024);
  if (!read.ok) return read.response;
  const body = read.body;
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) return new Response("Expected 2 to 50 places.", { status: 400 });

  // The places are checked numbers, so they can't change where the request goes.
  const path = parsed.data.coordinates.map(([lng, lat]) => `${lng.toFixed(6)},${lat.toFixed(6)}`);
  const url = new URL(
    `route/v1/driving/${path.join(";")}?overview=full&geometries=geojson`,
    base.endsWith("/") ? base : `${base}/`,
  );

  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (!response.ok) return new Response("The routing server said no.", { status: 502 });
    const route = osrmSchema.safeParse(await response.json());
    if (!route.success)
      return new Response("The routing server's answer wasn't a route.", { status: 502 });
    return Response.json({ coordinates: route.data.routes[0]?.geometry.coordinates ?? [] });
  } catch {
    return new Response("The routing server didn't answer.", { status: 504 });
  }
}
