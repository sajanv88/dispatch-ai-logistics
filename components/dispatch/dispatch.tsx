"use client";

import type { MapStyle } from "@nuvui/map";
import { DeliveryRoute } from "@/components/delivery-route/delivery-route";
import { DispatchShell } from "@/components/dispatch-shell/dispatch-shell";
import { DispatchProvider, useDispatchStore } from "@/lib/store";

interface DispatchProps {
  mapStyle: MapStyle;
  demo: boolean;
}

/** The console: everything under it shares one store. */
export function Dispatch(props: DispatchProps) {
  return (
    <DispatchProvider>
      <Console {...props} />
    </DispatchProvider>
  );
}

function Console({ mapStyle, demo }: DispatchProps) {
  const store = useDispatchStore();
  return (
    <DispatchShell demo={demo} onReset={() => store.reset()} assistant={<p>Assistant</p>}>
      <DeliveryRoute mapStyle={mapStyle} />
    </DispatchShell>
  );
}
