import "server-only";
import { z } from "zod";

// Every setting the server reads, checked once. An empty value counts as unset,
// as it does in Vercel's dashboard.
const optional = z
  .string()
  .optional()
  .transform((value) => value?.trim() || undefined);

const schema = z.object({
  ANTHROPIC_API_KEY: optional,
  ANTHROPIC_MODEL: optional.transform((value) => value ?? "claude-haiku-5-5"),
  MAP_TILE_URL: optional,
  MAP_ATTRIBUTION: optional,
  ROUTING_URL: optional.pipe(z.url({ protocol: /^https?$/ }).optional()),
  UPSTASH_REDIS_REST_URL: optional,
  UPSTASH_REDIS_REST_TOKEN: optional,
});

export type ServerEnv = z.infer<typeof schema>;

let parsed: ServerEnv | undefined;

export function serverEnv(): ServerEnv {
  parsed ??= schema.parse(process.env);
  return parsed;
}
