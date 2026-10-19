"use client";

import type { MapStyle } from "@nuvui/map";
import { AssistantPanel } from "@/components/assistant-panel/assistant-panel";
import { DeliveryRoute } from "@/components/delivery-route/delivery-route";
import { DispatchShell } from "@/components/dispatch-shell/dispatch-shell";
import { StopDrawer } from "@/components/stop-drawer/stop-drawer";
import { AgentProvider, useAgent } from "@/lib/agent/agent-provider";
import { DispatchProvider, useDispatchStore } from "@/lib/store";

interface DispatchProps {
  mapStyle: MapStyle;
  demo: boolean;
}

const starters = [
  "Where is the van and what's next?",
  "Add a pickup at Oudegracht 158, Utrecht, right after the next stop",
  "Find a free charger near the next stop",
] as const;

/** The console: everything under it shares one store and one conversation. */
export function Dispatch(props: DispatchProps) {
  return (
    <DispatchProvider>
      <AgentProvider>
        <Console {...props} />
      </AgentProvider>
    </DispatchProvider>
  );
}

function Console({ mapStyle, demo }: DispatchProps) {
  const store = useDispatchStore();
  const agent = useAgent();
  return (
    <DispatchShell
      demo={demo}
      onReset={() => {
        agent.clear();
        store.reset();
      }}
      assistant={<AssistantPanel starters={starters} />}
    >
      <DeliveryRoute mapStyle={mapStyle} />
      <StopDrawer mapStyle={mapStyle} />
    </DispatchShell>
  );
}
