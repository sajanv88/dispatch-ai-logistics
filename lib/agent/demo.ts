import "server-only";
import { createUIMessageStream, createUIMessageStreamResponse, isStaticToolUIPart } from "ai";
import type { z } from "zod";
import {
  type ClientToolName,
  type DispatchUIMessage,
  deniedText,
  type inputSchemas,
} from "@/lib/agent/tools";
import { etas, nextStop } from "@/lib/geo";
import { findCharging, summarizeRoute } from "@/lib/route-ops";
import type { RouteState } from "@/lib/types";

// Demo mode: with no ANTHROPIC_API_KEY, the chat route answers from this
// script. It speaks the same stream as the model does, so the tool cards, the
// approvals and the changes to the round run exactly as they would live.

type ServerTool = "get_route" | "find_charging";
type Step =
  | { kind: "server"; tool: ServerTool; input: object; output: unknown }
  | { kind: "client"; tool: ClientToolName; input: z.infer<(typeof inputSchemas)[ClientToolName]> }
  | { kind: "text"; text: string };

/** What the assistant already did in this turn: each call, and how it ended. */
interface Done {
  tool: string;
  ok: boolean;
  denied: boolean;
  output: unknown;
}

function doneInThisTurn(messages: DispatchUIMessage[]): Done[] {
  const last = messages.at(-1);
  if (last?.role !== "assistant") return [];
  return last.parts.filter(isStaticToolUIPart).flatMap((part): Done[] => {
    const tool = part.type.slice("tool-".length);
    if (part.state === "output-available") {
      return [{ tool, ok: true, denied: false, output: part.output }];
    }
    if (part.state === "output-error") {
      return [{ tool, ok: false, denied: part.errorText === deniedText, output: part.errorText }];
    }
    return [];
  });
}

/**
 * A short string from a tool's output. The outputs come back from the
 * browser, so nothing in them is trusted: anything else reads as "".
 */
function field(output: unknown, key: string): string {
  if (typeof output !== "object" || output === null) return "";
  const value = (output as Record<string, unknown>)[key];
  return typeof value === "string" && value.length <= 120 ? value : "";
}

const stopName = (state: RouteState, id: string) =>
  state.stops.find((stop) => stop.id === id)?.name ?? "that stop";

/** After a no, the assistant stops and asks, as the system prompt tells the model to. */
const afterDenial: Step = {
  kind: "text",
  text: "Understood, I've left that as it was. What would you like instead?",
};

function afterError(done: Done): Step {
  const reason = typeof done.output === "string" ? done.output.slice(0, 300) : "";
  return { kind: "text", text: reason ? `That didn't work: ${reason}` : "That didn't work." };
}

// --- The four turns -------------------------------------------------------------

function whereIsTheVan(state: RouteState): Step[] {
  const summary = summarizeRoute(state);
  const next = nextStop(state);
  const times = etas(state);
  const todo = state.stops.filter((stop) => stop.status !== "done");
  const lastDone = state.stops.filter((stop) => stop.status === "done").at(-1);
  const late = todo.filter((stop) => times.get(stop.id)?.late).map((stop) => stop.name);
  const after = todo[1];
  const text = next
    ? [
        `${state.van.name} is at ${lastDone?.name ?? state.van.depot.name}. Next is ${next.name}, due at ${times.get(next.id)?.eta}`,
        after ? `, then ${after.name} in ${after.city} at ${times.get(after.id)?.eta}.` : ".",
        ` ${todo.length} stops to go, `,
        late.length > 0
          ? `and ${late.join(" and ")} will miss ${late.length === 1 ? "its" : "their"} window.`
          : "all on time.",
      ].join("")
    : "Every stop on the round is done.";
  return [
    { kind: "server", tool: "get_route", input: {}, output: summary },
    { kind: "text", text },
  ];
}

function addPickup(state: RouteState, done: Done[]): Step[] {
  const [added, reordered] = done;
  if (!added) {
    return [
      {
        kind: "client",
        tool: "add_stop",
        input: {
          address: "Oudegracht 158, Utrecht",
          kind: "pickup",
          window: { from: "12:00", to: "15:00" },
        },
      },
    ];
  }
  if (added.denied) return [afterDenial];
  if (!added.ok) return [afterError(added)];
  const id = field(added.output, "id");
  if (!state.stops.some((stop) => stop.id === id)) {
    return [{ kind: "text", text: "The pickup was added, but I couldn't find it on the round." }];
  }

  if (!reordered) {
    // Before the first Utrecht stop that isn't the new one.
    const todo = state.stops.filter((stop) => stop.status !== "done" && stop.id !== id);
    const at = todo.findIndex((stop) => stop.city === "Utrecht");
    const order = todo.map((stop) => stop.id);
    order.splice(at === -1 ? order.length : at, 0, id);
    return [
      {
        kind: "client",
        tool: "reorder_stops",
        input: { order, reason: "Keep the Utrecht stops together" },
      },
    ];
  }
  const name = stopName(state, id);
  if (!reordered.ok) {
    return [
      {
        kind: "text",
        text: `Added a pickup at ${name} at the end of the round, and left it there.`,
      },
    ];
  }
  const todo = state.stops.filter((stop) => stop.status !== "done");
  const following = todo[todo.findIndex((stop) => stop.id === id) + 1];
  return [
    {
      kind: "text",
      text: `Added a pickup at ${name}, Oudegracht 158, Utrecht${following ? `, and put it before ${following.name}` : ""}.`,
    },
  ];
}

function findACharger(state: RouteState): Step[] {
  const next = nextStop(state);
  if (!next)
    return [{ kind: "text", text: "Every stop is done, so the van can charge at the depot." }];
  const found = findCharging(state, next.id, true);
  if (!found.ok) return [{ kind: "text", text: found.error }];
  const [best] = found.value.chargers;
  return [
    {
      kind: "server",
      tool: "find_charging",
      input: { near_stop_id: next.id, free_only: true },
      output: found.value,
    },
    {
      kind: "text",
      text: best
        ? `${best.name}, ${best.address}, is ${best.kmFromStop} km from ${next.name} with ${best.free} sockets free at ${best.powerKw} kW.`
        : `There's no free charger near ${next.name} right now.`,
    },
  ];
}

function wrapUpStops(state: RouteState, done: Done[]): Step[] {
  const [delivered, removed, relabelled] = done;
  for (const step of done) {
    if (step.denied) return [afterDenial];
    if (!step.ok) return [afterError(step)];
  }
  const next = nextStop(state);
  if (!delivered) {
    if (!next) return [{ kind: "text", text: "Every stop on the round is already done." }];
    return [{ kind: "client", tool: "mark_delivered", input: { id: next.id } }];
  }
  if (!removed) {
    const todo = state.stops.filter((stop) => stop.status !== "done");
    const target = todo.find((stop) => stop.name === "Bloemenhuis Buiten") ?? todo.at(-1);
    if (!target) return [{ kind: "text", text: "There's nothing left to drop." }];
    return [
      {
        kind: "client",
        tool: "remove_stop",
        input: { id: target.id, reason: "Cancelled by the customer" },
      },
    ];
  }
  if (!relabelled) {
    if (!next) return [{ kind: "text", text: "Done. There's no stop left to relabel." }];
    return [{ kind: "client", tool: "regenerate_label", input: { stop_id: next.id } }];
  }
  const what = field(delivered.output, "delivered") || "the stop";
  const gone = field(removed.output, "removed") || "the cancelled stop";
  const tracking = field(relabelled.output, "tracking") || "a new tracking number";
  return [
    {
      kind: "text",
      text: `Marked ${what.split(",")[0]} delivered, dropped ${gone.split(",")[0]}, and ${next?.name ?? "the next stop"} has a new label, ${tracking}.`,
    },
  ];
}

function steps(messages: DispatchUIMessage[], state: RouteState): Step[] {
  const turn = messages.filter((message) => message.role === "user").length - 1;
  const done = doneInThisTurn(messages);
  switch (turn) {
    case 0:
      return whereIsTheVan(state);
    case 1:
      return addPickup(state, done);
    case 2:
      return findACharger(state);
    case 3:
      return wrapUpStops(state, done);
    default:
      return [
        {
          kind: "text",
          text: "That's the end of the demo script. Its answers are scripted: add an ANTHROPIC_API_KEY to talk to Claude, or press Reset demo to run it again.",
        },
      ];
  }
}

// --- The stream -----------------------------------------------------------------

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** The scripted reply, streamed as the model's would be. */
export function demoResponse(messages: DispatchUIMessage[], state: RouteState): Response {
  const stream = createUIMessageStream<DispatchUIMessage>({
    originalMessages: messages,
    execute: async ({ writer }) => {
      writer.write({ type: "start" });
      for (const step of steps(messages, state)) {
        // Unique across requests: a turn that goes on after an approval is
        // the same message, and its calls can't share an id.
        const id = `demo-${crypto.randomUUID()}`;
        writer.write({ type: "start-step" });
        if (step.kind === "text") {
          writer.write({ type: "text-start", id });
          // A few words at a time, so it reads as it would from a model.
          const words = step.text.split(/(?<= )/);
          for (let i = 0; i < words.length; i += 3) {
            writer.write({ type: "text-delta", id, delta: words.slice(i, i + 3).join("") });
            await pause(35);
          }
          writer.write({ type: "text-end", id });
        } else {
          await pause(250);
          writer.write({
            type: "tool-input-available",
            toolCallId: id,
            toolName: step.tool,
            input: step.input,
          });
          if (step.kind === "server") {
            await pause(300);
            writer.write({ type: "tool-output-available", toolCallId: id, output: step.output });
          }
        }
        writer.write({ type: "finish-step" });
      }
      writer.write({ type: "finish" });
    },
  });
  return createUIMessageStreamResponse({ stream });
}
