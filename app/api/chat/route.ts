import { anthropic } from "@ai-sdk/anthropic";
import {
  APICallError,
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  safeValidateUIMessages,
  stepCountIs,
  streamText,
  tool,
} from "ai";
import { systemPrompt } from "@/lib/agent/system-prompt";
import {
  chatRequestSchema,
  type DispatchUIMessage,
  descriptions,
  inputSchemas,
  toolDefinitions,
} from "@/lib/agent/tools";
import { serverEnv } from "@/lib/env";
import { findCharging, summarizeRoute } from "@/lib/route-ops";
import type { RouteState } from "@/lib/types";

export const maxDuration = 30;

const maxBodyBytes = 256 * 1024;

const reply = (message: string, status: number) =>
  new Response(message, { status, headers: { "content-type": "text/plain; charset=utf-8" } });

// The read-only tools run here, against the round the browser sent. The
// others have no `execute`, so the model's call goes to the browser.
function toolsFor(state: RouteState) {
  return {
    ...toolDefinitions,
    get_route: tool({
      description: descriptions.get_route,
      inputSchema: inputSchemas.get_route,
      execute: async () => summarizeRoute(state),
    }),
    find_charging: tool({
      description: descriptions.find_charging,
      inputSchema: inputSchemas.find_charging,
      execute: async ({ near_stop_id, free_only }) => {
        const found = findCharging(state, near_stop_id, free_only);
        if (!found.ok) throw new Error(found.error);
        return found.value;
      },
    }),
  };
}

function friendlyError(error: unknown): string {
  if (APICallError.isInstance(error)) {
    if (error.statusCode === 401)
      return "The Anthropic API key was refused. Check ANTHROPIC_API_KEY.";
    if (error.statusCode === 429 || error.statusCode === 529) {
      return "Anthropic is busy right now. Try again in a moment.";
    }
  }
  console.error(error);
  return "Something went wrong talking to the model. Try again.";
}

export async function POST(request: Request) {
  if (Number(request.headers.get("content-length") ?? 0) > maxBodyBytes) {
    return reply("That conversation is too long to send. Reset the demo to start again.", 413);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return reply("The request wasn't JSON.", 400);
  }
  const parsed = chatRequestSchema.safeParse(body);
  if (!parsed.success) return reply("The request didn't have a valid round and messages.", 400);

  const validated = await safeValidateUIMessages<DispatchUIMessage>({
    messages: parsed.data.messages,
    tools: toolDefinitions,
  });
  if (!validated.success) return reply("The messages weren't valid.", 400);
  const messages = validated.data;
  const state: RouteState = parsed.data.state;

  const env = serverEnv();
  if (!env.ANTHROPIC_API_KEY) {
    // Stand-in until demo mode answers here.
    return createUIMessageStreamResponse({
      stream: createUIMessageStream<DispatchUIMessage>({
        execute: ({ writer }) => {
          writer.write({ type: "text-start", id: "demo" });
          writer.write({
            type: "text-delta",
            id: "demo",
            delta: "There's no ANTHROPIC_API_KEY, so the assistant isn't connected.",
          });
          writer.write({ type: "text-end", id: "demo" });
        },
      }),
    });
  }

  const result = streamText({
    model: anthropic(env.ANTHROPIC_MODEL),
    // Cached with the tools before it, since neither changes between requests.
    instructions: {
      role: "system",
      content: systemPrompt,
      providerOptions: { anthropic: { cacheControl: { type: "ephemeral" } } },
    },
    messages: await convertToModelMessages(messages),
    tools: toolsFor(state),
    stopWhen: stepCountIs(4),
    maxOutputTokens: 1024,
    providerOptions: { anthropic: { thinking: { type: "disabled" } } },
  });

  return result.toUIMessageStreamResponse({
    originalMessages: messages,
    onError: friendlyError,
  });
}
