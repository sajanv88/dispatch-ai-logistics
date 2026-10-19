import "server-only";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { serverEnv } from "@/lib/env";

// Protects the API credits. Per IP an hour: 20 new messages, and 80 requests
// in all, since every approved change sends the conversation back to the
// model once more. And 12 messages in one conversation. Shared through
// Upstash Redis when it's configured, or kept in this server's memory, which
// is per instance and resets on a cold start: enough for a demo, not for a
// busy deployment.

export const messagesPerHour = 20;
export const requestsPerHour = 80;
export const turnsPerConversation = 12;
const windowMs = 60 * 60 * 1000;

interface Limiter {
  limit(key: string): Promise<{ success: boolean; reset: number }>;
}

function memoryLimiter(max: number): Limiter {
  const hits = new Map<string, number[]>();
  return {
    async limit(key) {
      const now = Date.now();
      const recent = (hits.get(key) ?? []).filter((at) => now - at < windowMs);
      const success = recent.length < max;
      if (success) recent.push(now);
      hits.set(key, recent);
      // Forget keys that have gone quiet, so the map doesn't grow forever.
      if (hits.size > 10_000) {
        for (const [other, times] of hits) {
          if (times.every((at) => now - at >= windowMs)) hits.delete(other);
        }
      }
      return { success, reset: (recent[0] ?? now) + windowMs };
    },
  };
}

function makeLimiter(max: number, prefix: string): Limiter {
  const { UPSTASH_REDIS_REST_URL: url, UPSTASH_REDIS_REST_TOKEN: token } = serverEnv();
  if (!url || !token) return memoryLimiter(max);
  return new Ratelimit({
    redis: new Redis({ url, token }),
    limiter: Ratelimit.slidingWindow(max, "1 h"),
    prefix,
  });
}

let limiters: { messages: Limiter; requests: Limiter } | undefined;

function getLimiters() {
  limiters ??= {
    messages: makeLimiter(messagesPerHour, "dispatch:messages"),
    requests: makeLimiter(requestsPerHour, "dispatch:requests"),
  };
  return limiters;
}

/** The caller's address, as Vercel and most proxies pass it on. */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip") || "unknown";
}

const minutesUntil = (reset: number) => Math.max(1, Math.ceil((reset - Date.now()) / 60_000));

/**
 * Counts a request against the caller's limits. A request that carries a new
 * message from the dispatcher counts against both; one that sends a tool's
 * result back counts only against the requests.
 */
export async function checkRate(
  ip: string,
  newMessage: boolean,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { messages, requests } = getLimiters();
  if (newMessage) {
    const sent = await messages.limit(ip);
    if (!sent.success) {
      return {
        ok: false,
        message: `You've sent ${messagesPerHour} messages in the last hour, which is this demo's limit. Try again in ${minutesUntil(sent.reset)} minutes.`,
      };
    }
  }
  const made = await requests.limit(ip);
  if (!made.success) {
    return {
      ok: false,
      message: `This demo has had too many requests from you in the last hour. Try again in ${minutesUntil(made.reset)} minutes.`,
    };
  }
  return { ok: true };
}
