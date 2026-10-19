/** A place, as longitude then latitude: the order GeoJSON and MapLibre use. */
export type LngLat = [lng: number, lat: number];

export type StopStatus = "done" | "next" | "planned";
export type StopKind = "delivery" | "pickup";

/** A delivery window in local time, "HH:MM". */
export interface TimeWindow {
  from: string;
  to: string;
}

export interface Parcel {
  weightKg: number;
  /** Code 128 friendly: capital letters and digits. */
  tracking: string;
  service: string;
}

export interface Stop {
  id: string;
  name: string;
  address: string;
  postcode: string;
  city: string;
  at: LngLat;
  kind: StopKind;
  window: TimeWindow;
  parcel: Parcel;
  status: StopStatus;
  /** When a done stop was completed, "HH:MM". */
  doneAt?: string | undefined;
}

export interface Depot {
  name: string;
  address: string;
  postcode: string;
  city: string;
  at: LngLat;
}

export interface Van {
  id: string;
  name: string;
  plate: string;
  driver: string;
  batteryPct: number;
  depot: Depot;
}

/** Everything the agent can change, and everything the chat route receives. */
export interface RouteState {
  van: Van;
  stops: Stop[];
  /** Next number for a new stop's id, so ids are never reused. */
  seq: number;
  /** The demo clock, "HH:MM". Fixed, so the server and the browser agree. */
  clock: string;
}

export interface Charger {
  id: string;
  name: string;
  operator: string;
  address: string;
  city: string;
  position: LngLat;
  powerKw: number;
  sockets: number;
  free: number;
}

export interface KnownAddress {
  /** Street and number, such as "Oudegracht 158". */
  street: string;
  postcode: string;
  city: string;
  /** A business at the address, used as the stop's name. */
  name: string;
  at: LngLat;
}
