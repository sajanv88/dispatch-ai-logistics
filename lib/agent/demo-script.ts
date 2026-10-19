// What the dispatcher says in demo mode, in order. The panel offers each one
// in turn, and the chat route answers the nth message with the nth turn of
// lib/agent/demo.ts, whatever was typed. Between them the four turns use every
// tool.
export const demoScript = [
  "Where is the van and what's next?",
  "Add a pickup at Oudegracht 158, Utrecht, before the other Utrecht stops",
  "The van is low on battery. Find a free charger near the next stop",
  "Mark the next stop delivered, drop Bloemenhuis Buiten and reissue the label for the stop after",
] as const;

/** Suggestions when there's an API key: the same ideas, for a real model. */
export const liveStarters = [
  "Where is the van and what's next?",
  "Add a pickup at Oudegracht 158, Utrecht, before the other Utrecht stops",
  "Find a free charger near the next stop",
] as const;
