"use client";

import { TruckIcon } from "@nuvui/icons";
import {
  type MapBounds,
  MapControls,
  MapMarker,
  MapRoute,
  type MapStyle,
  MapView,
  mapBoundsOf,
} from "@nuvui/map";
import { Badge, Button } from "@nuvui/react";
import { useId, useMemo } from "react";
import "@/components/map-worker";
import { etas, nextStop, routeLines, vanPosition } from "@/lib/geo";
import { useDispatch, useDispatchStore } from "@/lib/store";
import type { Stop, StopStatus } from "@/lib/types";
import { useRoadLines } from "./use-road-lines";
import "./delivery-route.scss";

const words: Record<StopStatus, string> = {
  done: "Done",
  next: "Next",
  planned: "Planned",
};
const intents = {
  done: "success",
  next: "primary",
  planned: "neutral",
} as const;

// The same area for the same places, so the map only refits when the round
// really covers somewhere else.
function useStableBounds(bounds: MapBounds | undefined): MapBounds | undefined {
  const key = JSON.stringify(bounds);
  // biome-ignore lint/correctness/useExhaustiveDependencies: keyed on the value, not the array
  return useMemo(() => bounds, [key]);
}

export function DeliveryRoute({ mapStyle, routing }: { mapStyle: MapStyle; routing: boolean }) {
  const store = useDispatchStore();
  const route = useDispatch((state) => state.route);
  const chosen = useDispatch((state) => state.selectedId);
  const headingId = useId();

  const times = useMemo(() => etas(route), [route]);
  const straight = useMemo(() => routeLines(route), [route]);
  const lines = useRoadLines(straight, routing);
  const van = useMemo(() => vanPosition(route), [route]);
  const bounds = useStableBounds(
    mapBoundsOf([route.van.depot.at, ...route.stops.map((stop) => stop.at)]),
  );

  const done = route.stops.filter((stop) => stop.status === "done");
  const next = nextStop(route);
  const lastDone = done.at(-1);

  const timeLine = (stop: Stop) => {
    if (stop.status === "done") {
      return stop.kind === "pickup" ? `Picked up at ${stop.doneAt}` : `Delivered at ${stop.doneAt}`;
    }
    const eta = times.get(stop.id);
    return `Due at ${eta?.eta ?? "?"}, window ${stop.window.from}–${stop.window.to}`;
  };

  return (
    <section className="delivery-route" aria-labelledby={headingId}>
      <div className="delivery-route__side">
        <header className="delivery-route__head">
          <h2 id={headingId} className="delivery-route__title">
            {route.van.name}, today's round
          </h2>
          <p className="delivery-route__summary" aria-live="polite">
            {done.length} of {route.stops.length} stops done.{" "}
            {next ? `Next is ${next.name}, due at ${times.get(next.id)?.eta}.` : "All stops done."}
          </p>
        </header>
        <ol className="delivery-route__stops" aria-label="Stops">
          {route.stops.map((stop, index) => {
            const late = times.get(stop.id)?.late;
            return (
              <li key={stop.id}>
                <button
                  type="button"
                  className="delivery-route__stop"
                  aria-pressed={chosen === stop.id}
                  onClick={() => store.select(chosen === stop.id ? null : stop.id)}
                >
                  <span
                    className="delivery-route__number"
                    data-state={stop.status}
                    aria-hidden="true"
                  >
                    {index + 1}
                  </span>
                  <span className="delivery-route__text">
                    <span className="delivery-route__name">{stop.name}</span>
                    <span className="delivery-route__line">
                      {stop.kind === "pickup" ? "Pickup, " : ""}
                      {stop.address}, {stop.city}
                    </span>
                    <span className="delivery-route__line">{timeLine(stop)}</span>
                  </span>
                  <span className="delivery-route__badges">
                    <Badge intent={intents[stop.status]} variant="outline">
                      {words[stop.status]}
                    </Badge>
                    {late ? <Badge intent="warning">Late</Badge> : null}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>
      <MapView
        className="delivery-route__map"
        aria-label={`${route.van.name}'s round on a map`}
        mapStyle={mapStyle}
        {...(bounds ? { bounds } : {})}
        boundsPadding={48}
        maxZoom={16}
      >
        {/* Solid for what's behind the van, dashes for what's ahead. */}
        <MapRoute coordinates={lines.driven} />
        {lines.ahead.length > 1 ? <MapRoute coordinates={lines.ahead} dashed /> : null}
        <MapMarker
          position={route.van.depot.at}
          label={`${route.van.depot.name}, where the van set out`}
        />
        {route.stops.map((stop, index) => (
          <MapMarker
            key={stop.id}
            position={stop.at}
            anchor="center"
            // The number isn't read, so the name says it.
            label={`Stop ${index + 1}, ${stop.name}, ${words[stop.status].toLowerCase()}`}
            open={chosen === stop.id}
            onOpenChange={(open) => {
              if (open) store.select(stop.id);
              else if (store.getState().selectedId === stop.id) store.select(null);
            }}
            popup={
              <>
                <strong>{stop.name}</strong>
                <br />
                {stop.address}, {stop.city}
                <br />
                {timeLine(stop)}
                <Button
                  intent="secondary"
                  size="sm"
                  className="delivery-route__popup-action"
                  onClick={() => store.openDrawer("label", stop.id)}
                >
                  Shipping label
                </Button>
              </>
            }
          >
            <span className="delivery-route__pin" data-state={stop.status}>
              {index + 1}
            </span>
          </MapMarker>
        ))}
        <MapMarker
          position={van}
          anchor="center"
          label={`${route.van.name}, now at ${lastDone ? lastDone.name : route.van.depot.name}`}
        >
          <span className="delivery-route__van">
            <TruckIcon size={18} />
          </span>
        </MapMarker>
        <MapControls />
      </MapView>
    </section>
  );
}
