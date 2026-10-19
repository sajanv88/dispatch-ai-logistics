import type { z } from "zod";
import type { ClientToolName, inputSchemas, ToolName } from "@/lib/agent/tools";
import { addressLabel, resolveAddress } from "@/lib/route-ops";
import type { RouteState } from "@/lib/types";

/** Each tool's name, in words a dispatcher would use. */
export const toolTitles: Record<ToolName, string> = {
  get_route: "Read the round",
  find_charging: "Find charging points",
  reorder_stops: "Reorder stops",
  add_stop: "Add a stop",
  remove_stop: "Remove a stop",
  mark_delivered: "Mark delivered",
  regenerate_label: "Reissue a label",
};

type Input<T extends ClientToolName> = z.infer<(typeof inputSchemas)[T]>;

const nameOf = (route: RouteState, id: string) =>
  route.stops.find((stop) => stop.id === id)?.name ?? `the stop ${id}`;

/**
 * The approval question: what will happen if the dispatcher says yes, said
 * from the round and the address book, not in the model's own words.
 */
export function approvalQuestion(name: ClientToolName, input: unknown, route: RouteState): string {
  switch (name) {
    case "reorder_stops": {
      const { order } = input as Input<"reorder_stops">;
      return `Put the stops still to do in this order: ${order.map((id) => nameOf(route, id)).join(", ")}?`;
    }
    case "add_stop": {
      const { address, kind, window } = input as Input<"add_stop">;
      // The same lookup the change will make, so what's approved is what's added.
      const found = resolveAddress(address);
      if (!found.ok) {
        return "That address isn't in the address book, so nothing can be added. Approve to tell the assistant, and it will offer known addresses.";
      }
      const when = window ? `, between ${window.from} and ${window.to}` : "";
      return `Add a ${kind} at ${addressLabel(found.address)}${when}, at the end of the round?`;
    }
    case "remove_stop": {
      const { id } = input as Input<"remove_stop">;
      return `Take ${nameOf(route, id)} off the round?`;
    }
    case "mark_delivered": {
      const { id } = input as Input<"mark_delivered">;
      return `Mark ${nameOf(route, id)} as delivered?`;
    }
    case "regenerate_label": {
      const { stop_id } = input as Input<"regenerate_label">;
      return `Issue a new tracking number and label for ${nameOf(route, stop_id)}?`;
    }
  }
}
