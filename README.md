# Dispatch

An AI logistics console. A dispatcher talks to a Claude agent that re-plans a delivery van's round on a live map: it reorders stops, adds pickups, marks deliveries, finds a free charger and reissues labels. Every change waits for the dispatcher's approval, and the stop list and the map move the moment it's approved.

Built with Next.js, the [Vercel AI SDK](https://ai-sdk.dev) and [nuvui](https://nuvui.nuvraxis.com). It uses no paid APIs, and it deploys without an Anthropic key: with none set, the chat runs a scripted demo that exercises every tool.

<!-- Replace the repository URL with this template's public GitHub address. -->
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FYOUR-ORG%2Fdispatch&project-name=dispatch&repository-name=dispatch)

## Run it locally

```sh
pnpm install
cp .env.example .env.local   # optional: add ANTHROPIC_API_KEY to talk to Claude
pnpm dev
```

Open http://localhost:3000. Without a key, a "Demo mode" badge shows and the suggestions walk through the script one turn at a time. **Reset demo** puts the round and the conversation back to the start.

| Script | What runs |
| --- | --- |
| `pnpm dev` | The dev server |
| `pnpm build` | A production build, type-checked with `tsc` |
| `pnpm lint` | Biome for TypeScript and JSON, stylelint for SCSS |
| `pnpm typecheck` | Route types, then `tsc --noEmit` |

## Environment variables

All of them are optional. Set them in `.env.local`, or in the Vercel project's settings, and redeploy.

| Variable | Default | What it does |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | unset: demo mode | Connects the chat to Claude. |
| `ANTHROPIC_MODEL` | `claude-haiku-5-5` | The model the agent runs on. |
| `MAP_TILE_URL` | OpenStreetMap's tiles | An XYZ tile template, or the address of a MapLibre style ending in `.json`. |
| `MAP_ATTRIBUTION` | © OpenStreetMap contributors | The credit in the map's corner. Text and `https` links only. |
| `ROUTING_URL` | unset: straight lines | An [OSRM](https://project-osrm.org) server, to draw the route along the roads. |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | unset: in-memory limits | [Upstash Redis](https://upstash.com), for rate limits shared by every instance. |

**Map tiles.** OpenStreetMap's tile servers are run by volunteers, and [their usage policy](https://operations.osmfoundation.org/policies/tiles/) doesn't allow heavy traffic. They're fine for trying the template; for anything public, set `MAP_TILE_URL` to a provider of your own.

## How it works

```
 Browser                                                  Server (stateless)
┌────────────────────────────────────────────┐          ┌──────────────────────────────────┐
│  Store: the round (stops, van, clock)      │          │  POST /api/chat                  │
│     │                    ▲                 │          │   1. size, schema and message    │
│     │ read               │ approved change │ messages │      checks                      │
│     ▼                    │                 │ + round  │   2. no key? scripted demo       │
│  Stop list + map    Assistant panel ───────┼─────────►│   3. turn cap and rate limits    │
│  Label / charging   (useChat)              │          │   4. Claude, with tools:         │
│  drawer                  ▲                 │ ◄────────┼──     get_route, find_charging    │
│                          │ tool call       │  stream  │      run here, on the round      │
│              Approve ────┘ waits here      │          │      sent; the rest go to the    │
└────────────────────────────────────────────┘          │      browser                     │
                                                        └──────────────────────────────────┘
```

- **One store, in the browser.** The round lives in [`lib/store.tsx`](lib/store.tsx). Each chat request carries it, so the server keeps nothing and there's no database.
- **Reading runs on the server.** `get_route` and `find_charging` run in the chat route against the round that was sent.
- **Changing runs in the browser, after approval.** `reorder_stops`, `add_stop`, `remove_stop`, `mark_delivered` and `regenerate_label` have no server-side `execute`. The model's call reaches the browser, the thread shows it with Approve and Deny, and only an approval runs it on the store. The result goes back to the model, which confirms what changed in one sentence.
- **One set of rules.** Every change is a pure function in [`lib/route-ops.ts`](lib/route-ops.ts), shared by the tools and demo mode, so what's approved is exactly what changes on the map.

| Where | What |
| --- | --- |
| `app/page.tsx` | Reads the settings on the server and renders the console |
| `app/api/chat/route.ts` | The agent: checks, rate limits, demo mode, Claude |
| `app/api/route-geometry/route.ts` | Optional OSRM proxy |
| `components/` | The screen, one folder per nuvui block: app shell, delivery route, assistant workspace, shipping label, charging map |
| `lib/agent/` | Tools, system prompt, approvals, the demo script |
| `lib/route-ops.ts`, `lib/geo.ts` | The round's rules, distances and ETAs |
| `lib/seed/` | The made-up round, chargers and address book |

### Protecting your API credits

- With no key, nothing is sent to Anthropic.
- Per IP an hour: 20 new messages, and 80 requests in all (each approved change sends the conversation back once more). Then a friendly message says when to try again.
- A conversation is capped at 12 messages, and **Reset demo** starts a new one.
- Replies are capped at 1,024 tokens, and extended thinking is off.
- The system prompt and the tools are marked for [prompt caching](https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching). Anthropic only caches prompts above a minimum length, so with a prompt this short caching may not take effect until you add to it.

Without Upstash, each server instance keeps its own limits in memory, and they reset when it restarts. Add Upstash for limits that hold across instances.

## Make it yours

**Your round.** Edit [`lib/seed/route.ts`](lib/seed/route.ts): the van, its depot, and the stops in order, each with its place as `[longitude, latitude]`, a time window, a parcel and a status. One stop is `next`; the ones before it are `done`, with a `doneAt` time. `clock` is the time of day the demo starts at.

**Your charging points.** Edit [`lib/seed/chargers.ts`](lib/seed/chargers.ts), or load them from your network's feed.

**Your address book.** `add_stop` only places addresses it knows, so it works offline with no geocoding service. Add yours to [`lib/seed/addresses.ts`](lib/seed/addresses.ts). Swap `resolveAddress` in `lib/route-ops.ts` for a geocoder if you have one.

**The demo script.** The lines are in [`lib/agent/demo-script.ts`](lib/agent/demo-script.ts) and the replies in [`lib/agent/demo.ts`](lib/agent/demo.ts). The replies are worked out from the round, so they still make sense after you change the seed. The fourth turn drops a stop named "Bloemenhuis Buiten", or the last stop if there isn't one.

**The look.** The screen is built from [nuvui blocks](https://nuvui.nuvraxis.com/blocks), themed with CSS variables. Dark mode follows the system.
