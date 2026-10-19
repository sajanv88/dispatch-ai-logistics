import type { LngLat, RouteState, Stop } from "@/lib/types";

const earthKm = 6371;
const rad = (deg: number) => (deg * Math.PI) / 180;

/** Distance as the crow flies, in kilometres. */
export function haversineKm(a: LngLat, b: LngLat): number {
  const dLat = rad(b[1] - a[1]);
  const dLng = rad(b[0] - a[0]);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dLng / 2) ** 2;
  return 2 * earthKm * Math.asin(Math.sqrt(h));
}

export function toMinutes(time: string): number {
  const [h = "0", m = "0"] = time.split(":");
  return Number(h) * 60 + Number(m);
}

export function fromMinutes(total: number): string {
  const day = 24 * 60;
  const minutes = ((Math.round(total) % day) + day) % day;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// Roads aren't straight: a straight line is about three quarters of the way
// driven. Short hops are city streets, long ones are motorway.
const roadFactor = 1.3;
const cityKmh = 25;
const motorwayKmh = 70;
const motorwayFromKm = 8;
const serviceMinutes = 4;

export function driveMinutes(from: LngLat, to: LngLat): number {
  const km = haversineKm(from, to) * roadFactor;
  return (km / (km > motorwayFromKm ? motorwayKmh : cityKmh)) * 60;
}

/** Where the van is: at the last stop it finished, or at the depot. */
export function vanPosition(state: RouteState): LngLat {
  const done = state.stops.filter((stop) => stop.status === "done");
  return done.at(-1)?.at ?? state.van.depot.at;
}

export interface Eta {
  /** Arrival, "HH:MM". */
  eta: string;
  /** Arrives after the window closes. */
  late: boolean;
  /** Road distance of the leg into this stop, in kilometres. */
  legKm: number;
}

/**
 * Arrival times for every stop still to do, in route order, from where the
 * van is now and the demo clock. A van that's early waits for the window.
 */
export function etas(state: RouteState): Map<string, Eta> {
  const out = new Map<string, Eta>();
  let at = vanPosition(state);
  let now = toMinutes(state.clock);
  for (const stop of state.stops) {
    if (stop.status === "done") continue;
    const legKm = haversineKm(at, stop.at) * roadFactor;
    const arrive = Math.max(now + driveMinutes(at, stop.at), toMinutes(stop.window.from));
    out.set(stop.id, {
      eta: fromMinutes(arrive),
      late: arrive > toMinutes(stop.window.to),
      legKm: Math.round(legKm * 10) / 10,
    });
    now = arrive + serviceMinutes;
    at = stop.at;
  }
  return out;
}

/** The van's way so far, and the way still ahead, for a solid and a dashed line. */
export function routeLines(state: RouteState): { driven: LngLat[]; ahead: LngLat[] } {
  const done = state.stops.filter((stop) => stop.status === "done").map((stop) => stop.at);
  const todo = state.stops.filter((stop) => stop.status !== "done").map((stop) => stop.at);
  const van = vanPosition(state);
  return {
    driven: [state.van.depot.at, ...done],
    ahead: todo.length > 0 ? [van, ...todo] : [],
  };
}

export function nextStop(state: RouteState): Stop | undefined {
  return state.stops.find((stop) => stop.status === "next");
}
