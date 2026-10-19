"use client";

import { TruckIcon } from "@nuvui/icons";
import {
  MapClusters,
  MapControls,
  MapMarker,
  type MapStyle,
  MapView,
  mapBoundsOf,
} from "@nuvui/map";
import { Switch } from "@nuvui/react";
import { useId, useMemo, useState } from "react";
import "@/components/map-worker";
import { haversineKm, vanPosition } from "@/lib/geo";
import { chargers } from "@/lib/seed/chargers";
import { useDispatch } from "@/lib/store";
import type { Charger } from "@/lib/types";
import "./charging-map.scss";

const sockets = (charger: Charger) =>
  charger.free === 0 ? "All in use" : `${charger.free} of ${charger.sockets} free`;

/**
 * The charging-map block, around the van: the charging points nearest it
 * first, and by default only those with a socket free.
 */
export function ChargingMap({ mapStyle }: { mapStyle: MapStyle }) {
  const route = useDispatch((state) => state.route);
  const [freeOnly, setFreeOnly] = useState(true);
  // The charging point that's open, in the list and on the map.
  const [chosen, setChosen] = useState<string | null>(null);
  const id = useId();
  const van = useMemo(() => vanPosition(route), [route]);

  const shown = useMemo(
    () =>
      chargers
        .filter((charger) => !freeOnly || charger.free > 0)
        .map((charger) => ({ ...charger, km: haversineKm(van, charger.position) }))
        .sort((a, b) => a.km - b.km),
    [freeOnly, van],
  );
  const open = shown.find((charger) => charger.id === chosen);
  // The van and the nearest few, so the map opens on what's useful.
  const bounds = useMemo(
    () => mapBoundsOf([van, ...shown.slice(0, 4).map((charger) => charger.position)]),
    [van, shown],
  );

  return (
    <div className="charging-map">
      <div className="charging-map__side">
        <div className="charging-map__filter">
          <label htmlFor={`${id}-free`}>Only with a socket free</label>
          <Switch
            id={`${id}-free`}
            checked={freeOnly}
            onCheckedChange={(next) => {
              setFreeOnly(next);
              setChosen(null);
            }}
          />
        </div>
        <p className="charging-map__count" role="status">
          {shown.length} charging points, nearest the van first
        </p>
        <ul className="charging-map__list" aria-label="Charging points">
          {shown.map((charger) => (
            <li key={charger.id}>
              <button
                type="button"
                className="charging-map__point"
                aria-pressed={chosen === charger.id}
                onClick={() => setChosen((now) => (now === charger.id ? null : charger.id))}
              >
                <span className="charging-map__name">{charger.name}</span>
                <span className="charging-map__line">
                  {sockets(charger)}, {charger.powerKw} kW, {charger.km.toFixed(1)} km from the van
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
      <MapView
        className="charging-map__map"
        aria-label="Charging points near the van on a map"
        mapStyle={mapStyle}
        {...(bounds ? { bounds } : {})}
        boundsPadding={48}
        // One chosen in the list is gone to, near enough that it stands on
        // its own and its popup can open.
        {...(open ? { center: open.position, zoom: 15 } : {})}
      >
        <MapClusters points={shown} clusterLabel={(count) => `${count} charging points`}>
          {(charger) => (
            <MapMarker
              position={charger.position}
              label={`${charger.name}, ${sockets(charger).toLowerCase()}`}
              open={chosen === charger.id}
              onOpenChange={(next) => setChosen(next ? charger.id : null)}
              popup={
                <>
                  <strong>{charger.name}</strong>
                  <br />
                  {charger.address}, {charger.city}
                  <br />
                  {sockets(charger)}, {charger.powerKw} kW
                </>
              }
            />
          )}
        </MapClusters>
        <MapMarker position={van} anchor="center" label={`${route.van.name}, where the van is now`}>
          <span className="charging-map__van">
            <TruckIcon size={18} />
          </span>
        </MapMarker>
        <MapControls />
      </MapView>
    </div>
  );
}
