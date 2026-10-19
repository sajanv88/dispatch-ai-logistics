import { type InferUITools, tool, type UIDataTypes, type UIMessage } from "ai";
import { z } from "zod";
import { maxWeightKg } from "@/lib/route-ops";

// The agent's tools, as the model sees them. The read-only ones are run on
// the server (see app/api/chat/route.ts). The ones that change the round have
// no `execute`: the browser runs them, after the dispatcher approves.

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "A time as HH:MM");
const stopId = z.string().max(20).describe("A stop's id, such as s4, from get_route");
const reason = z.string().max(200).describe("Why, in a few words, for the dispatcher");

/** Each tool's input. The browser checks a call against these before running it. */
export const inputSchemas = {
  get_route: z.object({}),
  find_charging: z.object({
    near_stop_id: stopId,
    free_only: z.boolean().describe("Only charging points with a socket free now"),
  }),
  reorder_stops: z.object({
    order: z
      .array(stopId)
      .min(1)
      .max(40)
      .describe("Ids of the stops still to do, in the new order"),
    reason,
  }),
  add_stop: z.object({
    address: z.string().min(2).max(120).describe("Street and number, and the city"),
    kind: z.enum(["delivery", "pickup"]),
    window: z
      .object({ from: time, to: time })
      .optional()
      .describe("When the customer can take it, local time"),
    parcel: z
      .object({
        weightKg: z.number().positive().max(maxWeightKg).optional(),
        service: z.string().max(40).optional(),
      })
      .optional(),
  }),
  remove_stop: z.object({ id: stopId, reason }),
  mark_delivered: z.object({ id: stopId }),
  regenerate_label: z.object({ stop_id: stopId }),
};

export const descriptions = {
  get_route:
    "The round as it is now: every stop in order with its id, status, time window and ETA, and where the van is. Call it before changing anything.",
  find_charging: "Charging points nearest a stop, closest first, with how many sockets are free.",
  reorder_stops:
    "Puts the stops still to do in a new order. Give every stop that isn't done exactly once. Needs the dispatcher's approval.",
  add_stop:
    "Adds a delivery or a pickup at the end of the round. The address must be in the address book: when it isn't, the result lists known addresses to choose from. Reorder afterwards to place it. Needs the dispatcher's approval.",
  remove_stop: "Takes a stop that isn't done off the round. Needs the dispatcher's approval.",
  mark_delivered: "Marks a stop as done, at its ETA. Needs the dispatcher's approval.",
  regenerate_label:
    "Issues a new tracking number for a stop's parcel, with a new barcode and QR code on its label. Needs the dispatcher's approval.",
} satisfies Record<keyof typeof inputSchemas, string>;

// What a tool gives back isn't checked: the read-only ones are ours, and the
// browser's are built from the same route operations.
const anyOutput = z.unknown();

/** Every tool, without `execute`. The chat route adds it to the read-only ones. */
export const toolDefinitions = {
  get_route: tool({
    description: descriptions.get_route,
    inputSchema: inputSchemas.get_route,
    outputSchema: anyOutput,
  }),
  find_charging: tool({
    description: descriptions.find_charging,
    inputSchema: inputSchemas.find_charging,
    outputSchema: anyOutput,
  }),
  reorder_stops: tool({
    description: descriptions.reorder_stops,
    inputSchema: inputSchemas.reorder_stops,
    outputSchema: anyOutput,
  }),
  add_stop: tool({
    description: descriptions.add_stop,
    inputSchema: inputSchemas.add_stop,
    outputSchema: anyOutput,
  }),
  remove_stop: tool({
    description: descriptions.remove_stop,
    inputSchema: inputSchemas.remove_stop,
    outputSchema: anyOutput,
  }),
  mark_delivered: tool({
    description: descriptions.mark_delivered,
    inputSchema: inputSchemas.mark_delivered,
    outputSchema: anyOutput,
  }),
  regenerate_label: tool({
    description: descriptions.regenerate_label,
    inputSchema: inputSchemas.regenerate_label,
    outputSchema: anyOutput,
  }),
};

export type ToolName = keyof typeof toolDefinitions;

/** The tools the browser runs, each only once the dispatcher has approved it. */
export const clientTools = [
  "reorder_stops",
  "add_stop",
  "remove_stop",
  "mark_delivered",
  "regenerate_label",
] as const satisfies readonly ToolName[];
export type ClientToolName = (typeof clientTools)[number];

export const isClientTool = (name: string): name is ClientToolName =>
  (clientTools as readonly string[]).includes(name);

export type DispatchTools = InferUITools<typeof toolDefinitions>;
export type DispatchUIMessage = UIMessage<unknown, UIDataTypes, DispatchTools>;

/** What the browser sends back when the dispatcher says no. */
export const deniedText = "The dispatcher denied this change. Nothing was changed.";

// --- The request ----------------------------------------------------------------

const lngLat = z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]);
const place = { postcode: z.string().max(12), city: z.string().max(60), at: lngLat };

/** The round the browser sends with each message. The server keeps nothing. */
export const routeStateSchema = z.object({
  clock: time,
  seq: z.number().int().nonnegative().max(10_000),
  van: z.object({
    id: z.string().max(40),
    name: z.string().max(60),
    plate: z.string().max(20),
    driver: z.string().max(60),
    batteryPct: z.number().min(0).max(100),
    depot: z.object({ name: z.string().max(80), address: z.string().max(120), ...place }),
  }),
  stops: z
    .array(
      z.object({
        id: z.string().max(20),
        name: z.string().max(80),
        address: z.string().max(120),
        ...place,
        kind: z.enum(["delivery", "pickup"]),
        window: z.object({ from: time, to: time }),
        parcel: z.object({
          weightKg: z.number().positive().max(maxWeightKg),
          tracking: z.string().regex(/^[A-Z0-9]{4,20}$/),
          service: z.string().max(40),
        }),
        status: z.enum(["done", "next", "planned"]),
        doneAt: time.optional(),
      }),
    )
    .max(40),
});

export const chatRequestSchema = z.object({
  messages: z.array(z.unknown()).min(1).max(80),
  state: routeStateSchema,
});
