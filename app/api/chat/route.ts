import { anthropic } from "@ai-sdk/anthropic";
import {
  APICallError,
  convertToModelMessages,
  safeValidateUIMessages,
  stepCountIs,
  streamText,
  tool,
} from "ai";
import { demoResponse } from "@/lib/agent/demo";
import { systemPrompt } from "@/lib/agent/system-prompt";
import {
  chatRequestSchema,
  type DispatchUIMessage,
  descriptions,
  inputSchemas,
  toolDefinitions,
} from "@/lib/agent/tools";
import { serverEnv } from "@/lib/env";
import { checkRate, clientIp, turnsPerConversation } from "@/lib/rate-limit";
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
  const status = APICallError.isInstance(error) ? error.statusCode : undefined;
  // Only what says what went wrong: the error object also carries the
  // conversation it was sent with.
  console.error("chat failed", {
    name: error instanceof Error ? error.name : typeof error,
    status,
    message: error instanceof Error ? error.message : String(error),
  });
  if (status === 401) return "The Anthropic API key was refused. Check ANTHROPIC_API_KEY.";
  if (status === 429 || status === 529)
    return "Anthropic is busy right now. Try again in a moment.";
  return "Something went wrong talking to the model. Try again.";
}

const tooLong = () =>
  reply("That conversation is too long to send. Reset the demo to start again.", 413);

/** The body as JSON, refused past the size limit whatever Content-Length says. */
async function readJson(
  request: Request,
): Promise<{ ok: true; body: unknown } | { ok: false; response: Response }> {
  if (Number(request.headers.get("content-length") ?? 0) > maxBodyBytes) {
    return { ok: false, response: tooLong() };
  }
  const bytes = await request.arrayBuffer();
  if (bytes.byteLength > maxBodyBytes) return { ok: false, response: tooLong() };
  try {
    return { ok: true, body: JSON.parse(new TextDecoder().decode(bytes)) };
  } catch {
    return { ok: false, response: reply("The request wasn't JSON.", 400) };
  }
}

export async function POST(request: Request) {
  const read = await readJson(request);
  if (!read.ok) return read.response;
  const { body } = read;
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
  // No key: the scripted conversation, which costs nothing and isn't limited.
  if (!env.ANTHROPIC_API_KEY) return demoResponse(messages, state);

  // Every check that protects the credits comes before the model is called.
  const turns = messages.filter((message) => message.role === "user").length;
  if (turns > turnsPerConversation) {
    return reply(
      `This conversation has reached its ${turnsPerConversation} messages. Press Reset demo to start a new one.`,
      429,
    );
  }
  const rate = await checkRate(clientIp(request), messages.at(-1)?.role === "user");
  if (!rate.ok) return reply(rate.message, 429);

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
