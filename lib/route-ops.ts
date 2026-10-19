import { etas, haversineKm, toMinutes, vanPosition } from "@/lib/geo";
import { knownAddresses } from "@/lib/seed/addresses";
import { chargers } from "@/lib/seed/chargers";
import type { KnownAddress, RouteState, Stop, StopKind, TimeWindow } from "@/lib/types";

// Every change the agent can make to the round, as a pure function of the
// state. The store, the client-side tools and demo mode all call these, so
// what's approved in the chat is exactly what changes on the map.

export type OpResult<T> = { ok: true; state: RouteState; value: T } | { ok: false; error: string };

const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });

/** Done stops first, in the order they were done; the first one left is next. */
function normalize(stops: Stop[]): Stop[] {
  const done = stops.filter((stop) => stop.status === "done");
  const todo = stops.filter((stop) => stop.status !== "done");
  return [
    ...done,
    ...todo.map((stop, index): Stop => ({ ...stop, status: index === 0 ? "next" : "planned" })),
  ];
}

const describe = (stop: Stop) => `${stop.name}, ${stop.address}, ${stop.city}`;

export const maxWeightKg = 1000;
export const isTime = (value: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(value);

export function newTrackingNumber(): string {
  const digits = crypto.getRandomValues(new Uint32Array(2));
  const number = `${digits[0] ?? 0}${digits[1] ?? 0}`.padEnd(10, "0").slice(0, 10);
  return `DX${number}`;
}

// --- Reading -----------------------------------------------------------------

export function summarizeRoute(state: RouteState) {
  const times = etas(state);
  const [lng, lat] = vanPosition(state);
  return {
    clock: state.clock,
    van: {
      name: state.van.name,
      driver: state.van.driver,
      batteryPct: state.van.batteryPct,
      position: { lat, lng },
    },
    stops: state.stops.map((stop, index) => ({
      order: index + 1,
      id: stop.id,
      name: stop.name,
      address: `${stop.address}, ${stop.city}`,
      kind: stop.kind,
      status: stop.status,
      window: `${stop.window.from}-${stop.window.to}`,
      ...(stop.doneAt ? { doneAt: stop.doneAt } : {}),
      ...(times.has(stop.id) ? times.get(stop.id) : {}),
      parcel: { weightKg: stop.parcel.weightKg, tracking: stop.parcel.tracking },
    })),
  };
}

export function findCharging(state: RouteState, nearStopId: string, freeOnly: boolean) {
  const near = state.stops.find((stop) => stop.id === nearStopId);
  if (!near) return fail(`There's no stop with id ${nearStopId}.`);
  const found = chargers
    .filter((charger) => !freeOnly || charger.free > 0)
    .map((charger) => ({ charger, km: haversineKm(near.at, charger.position) }))
    .sort((a, b) => a.km - b.km)
    .slice(0, 4)
    .map(({ charger, km }) => ({
      id: charger.id,
      name: charger.name,
      address: `${charger.address}, ${charger.city}`,
      powerKw: charger.powerKw,
      free: `${charger.free} of ${charger.sockets}`,
      kmFromStop: Math.round(km * 10) / 10,
    }));
  return { ok: true as const, value: { near: describe(near), chargers: found } };
}

// --- Addresses ----------------------------------------------------------------

const plain = (text: string) =>
  text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

export type AddressLookup =
  | { ok: true; address: KnownAddress }
  | { ok: false; error: string; suggestions: string[] };

export const addressLabel = (address: KnownAddress) =>
  `${address.name}, ${address.street}, ${address.city}`;
const label = addressLabel;

const cities = new Set(knownAddresses.map((address) => plain(address.city)));

/**
 * Finds an address in the lookup table, by street and number or by business
 * name, as whole words: "Damrak 10" isn't "Damrak 1". When the query names a
 * city, the address has to be in it.
 */
export function resolveAddress(query: string): AddressLookup {
  const q = ` ${plain(query)} `;
  const has = (phrase: string) => q.includes(` ${plain(phrase)} `);
  const named = [...cities].filter((city) => q.includes(` ${city} `));
  const exact = knownAddresses.find(
    (address) =>
      (has(address.street) || has(address.name)) &&
      (named.length === 0 || named.includes(plain(address.city))),
  );
  if (exact) return { ok: true, address: exact };

  // Not found: offer the known addresses nearest to what was asked, in the
  // same city if one was named, or on the same street.
  const words = new Set(q.trim().split(" "));
  const inCity = knownAddresses.filter((address) => words.has(plain(address.city)));
  const onStreet = knownAddresses.filter((address) =>
    plain(address.street)
      .split(" ")
      .some((word) => word.length > 3 && words.has(word)),
  );
  const pool = onStreet.length > 0 ? onStreet : inCity.length > 0 ? inCity : knownAddresses;
  return {
    ok: false,
    error: `"${query}" isn't in the address book, so it can't be placed on the map.`,
    suggestions: pool.slice(0, 8).map(label),
  };
}

// --- Changes ------------------------------------------------------------------

export function reorderStops(state: RouteState, order: string[]): OpResult<string[]> {
  const todo = state.stops.filter((stop) => stop.status !== "done");
  const ids = new Set(todo.map((stop) => stop.id));
  const unknown = order.filter((id) => !ids.has(id));
  if (unknown.length > 0) {
    return fail(
      `These ids aren't stops still to do: ${unknown.join(", ")}. Stops still to do: ${[...ids].join(", ")}.`,
    );
  }
  if (new Set(order).size !== order.length || order.length !== ids.size) {
    return fail(`Give every stop still to do exactly once: ${[...ids].join(", ")}.`);
  }
  const byId = new Map(todo.map((stop) => [stop.id, stop]));
  const done = state.stops.filter((stop) => stop.status === "done");
  const stops = normalize([...done, ...order.map((id) => byId.get(id) as Stop)]);
  return { ok: true, state: { ...state, stops }, value: stops.map((stop) => stop.id) };
}

export interface NewStop {
  address: string;
  kind: StopKind;
  window?: TimeWindow | undefined;
  parcel?: { weightKg?: number | undefined; service?: string | undefined } | undefined;
}

export function addStop(
  state: RouteState,
  input: NewStop,
):
  | OpResult<{ id: string; name: string; address: string }>
  | { ok: false; error: string; suggestions: string[] } {
  // The tools' schemas check this too. These functions are also called by
  // demo mode and anything else, so they don't trust their input either.
  const { window, parcel } = input;
  if (window) {
    if (!isTime(window.from) || !isTime(window.to)) {
      return fail(`A window is two times as HH:MM, such as 13:00 and 15:30.`);
    }
    if (toMinutes(window.from) >= toMinutes(window.to)) {
      return fail(`The window has to end after it starts.`);
    }
  }
  const weightKg = parcel?.weightKg ?? 2;
  if (!Number.isFinite(weightKg) || weightKg <= 0 || weightKg > maxWeightKg) {
    return fail(`A parcel weighs between 0 and ${maxWeightKg} kg.`);
  }
  const found = resolveAddress(input.address);
  if (!found.ok) return found;
  const { address } = found;
  const id = `s${state.seq}`;
  const stop: Stop = {
    id,
    name: address.name,
    address: address.street,
    postcode: address.postcode,
    city: address.city,
    at: address.at,
    kind: input.kind,
    window: window ?? { from: state.clock, to: "17:00" },
    parcel: {
      weightKg,
      service: parcel?.service?.slice(0, 40) ?? (input.kind === "pickup" ? "Return" : "Standard"),
      tracking: newTrackingNumber(),
    },
    status: "planned",
  };
  return {
    ok: true,
    state: { ...state, seq: state.seq + 1, stops: normalize([...state.stops, stop]) },
    value: { id, name: stop.name, address: `${stop.address}, ${stop.city}` },
  };
}

export function removeStop(state: RouteState, id: string): OpResult<{ removed: string }> {
  const stop = state.stops.find((other) => other.id === id);
  if (!stop) return fail(`There's no stop with id ${id}.`);
  if (stop.status === "done") return fail(`${stop.name} is already done and can't be removed.`);
  const stops = normalize(state.stops.filter((other) => other.id !== id));
  return { ok: true, state: { ...state, stops }, value: { removed: describe(stop) } };
}

export function markDelivered(
  state: RouteState,
  id: string,
): OpResult<{ delivered: string; at: string }> {
  const stop = state.stops.find((other) => other.id === id);
  if (!stop) return fail(`There's no stop with id ${id}.`);
  if (stop.status === "done") return fail(`${stop.name} is already done.`);
  // The clock moves on to when the van got there.
  const at = etas(state).get(id)?.eta ?? state.clock;
  const done: Stop = { ...stop, status: "done", doneAt: at };
  const others = state.stops.filter((other) => other.id !== id);
  const lastDone = others.findLastIndex((other) => other.status === "done");
  const stops = normalize([...others.slice(0, lastDone + 1), done, ...others.slice(lastDone + 1)]);
  return {
    ok: true,
    state: { ...state, clock: at, stops },
    value: { delivered: describe(stop), at },
  };
}

export function regenerateLabel(
  state: RouteState,
  id: string,
): OpResult<{ stop: string; oldTracking: string; tracking: string }> {
  const stop = state.stops.find((other) => other.id === id);
  if (!stop) return fail(`There's no stop with id ${id}.`);
  if (stop.status === "done") {
    return fail(`${stop.name} is already done, so its label can't be reissued.`);
  }
  const tracking = newTrackingNumber();
  const stops = state.stops.map((other) =>
    other.id === id ? { ...other, parcel: { ...other.parcel, tracking } } : other,
  );
  return {
    ok: true,
    state: { ...state, stops },
    value: { stop: describe(stop), oldTracking: stop.parcel.tracking, tracking },
  };
}
