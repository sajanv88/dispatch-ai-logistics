"use client";

import type { MapStyle } from "@nuvui/map";
import { AssistantPanel } from "@/components/assistant-panel/assistant-panel";
import { DeliveryRoute } from "@/components/delivery-route/delivery-route";
import { DispatchShell } from "@/components/dispatch-shell/dispatch-shell";
import { StopDrawer } from "@/components/stop-drawer/stop-drawer";
import { AgentProvider, useAgent } from "@/lib/agent/agent-provider";
import { demoScript, liveStarters } from "@/lib/agent/demo-script";
import { DispatchProvider, useDispatchStore } from "@/lib/store";

interface DispatchProps {
  mapStyle: MapStyle;
  demo: boolean;
  /** Whether the server can draw the way along the roads. */
  routing: boolean;
}

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

function Console({ mapStyle, demo, routing }: DispatchProps) {
  const store = useDispatchStore();
  const agent = useAgent();
  return (
    <DispatchShell
      demo={demo}
      onReset={() => {
        agent.clear();
        store.reset();
      }}
      assistant={<AssistantPanel demo={demo} starters={demo ? demoScript : liveStarters} />}
    >
      <DeliveryRoute mapStyle={mapStyle} routing={routing} />
      <StopDrawer mapStyle={mapStyle} />
    </DispatchShell>
  );
}
