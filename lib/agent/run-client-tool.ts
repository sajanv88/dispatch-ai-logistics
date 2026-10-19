import { type ClientToolName, inputSchemas } from "@/lib/agent/tools";
import { addStop, markDelivered, regenerateLabel, removeStop, reorderStops } from "@/lib/route-ops";
import type { DispatchStore } from "@/lib/store";

export type ToolRun = { ok: true; output: unknown } | { ok: false; error: string };

const invalid = (name: ClientToolName): ToolRun => ({
  ok: false,
  error: `The input for ${name} wasn't valid.`,
});

function finish<T>(result: { ok: true; value: T } | { ok: false; error: string }): ToolRun {
  return result.ok ? { ok: true, output: result.value } : { ok: false, error: result.error };
}

/**
 * Runs a tool that changes the round, once the dispatcher has approved it.
 * The model's input is checked again here, where it's acted on. The store
 * changes at once, so the list and the map move as the result goes back to
 * the model.
 */
export function runClientTool(store: DispatchStore, name: ClientToolName, input: unknown): ToolRun {
  switch (name) {
    case "reorder_stops": {
      const parsed = inputSchemas.reorder_stops.safeParse(input);
      if (!parsed.success) return invalid(name);
      return finish(store.run((route) => reorderStops(route, parsed.data.order)));
    }
    case "add_stop": {
      const parsed = inputSchemas.add_stop.safeParse(input);
      if (!parsed.success) return invalid(name);
      const result = addStop(store.getState().route, parsed.data);
      if (!result.ok) {
        const known =
          "suggestions" in result ? ` Known addresses: ${result.suggestions.join("; ")}.` : "";
        return { ok: false, error: `${result.error}${known}` };
      }
      return finish(store.run(() => result));
    }
    case "remove_stop": {
      const parsed = inputSchemas.remove_stop.safeParse(input);
      if (!parsed.success) return invalid(name);
      return finish(store.run((route) => removeStop(route, parsed.data.id)));
    }
    case "mark_delivered": {
      const parsed = inputSchemas.mark_delivered.safeParse(input);
      if (!parsed.success) return invalid(name);
      return finish(store.run((route) => markDelivered(route, parsed.data.id)));
    }
    case "regenerate_label": {
      const parsed = inputSchemas.regenerate_label.safeParse(input);
      if (!parsed.success) return invalid(name);
      return finish(store.run((route) => regenerateLabel(route, parsed.data.stop_id)));
    }
  }
}
