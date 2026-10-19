"use client";

import type { MapStyle } from "@nuvui/map";
import {
  Label,
  NativeSelect,
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@nuvui/react";
import { useId } from "react";
import { ChargingMap } from "@/components/charging-map/charging-map";
import { ShippingLabel } from "@/components/shipping-label/shipping-label";
import { type DrawerTab, useDispatch, useDispatchStore } from "@/lib/store";
import "./stop-drawer.scss";

const isTab = (value: string): value is DrawerTab => value === "label" || value === "charging";

/** A stop's shipping label, and where the van can charge, over the page. */
export function StopDrawer({ mapStyle }: { mapStyle: MapStyle }) {
  const store = useDispatchStore();
  const drawer = useDispatch((state) => state.drawer);
  const route = useDispatch((state) => state.route);
  const selectedId = useDispatch((state) => state.selectedId);
  const pickerId = useId();
  const stop =
    route.stops.find((other) => other.id === selectedId) ??
    route.stops.find((other) => other.status === "next") ??
    route.stops[0];

  return (
    <Sheet open={drawer.open} onOpenChange={(open) => (open ? null : store.closeDrawer())}>
      <SheetContent side="end" size="lg">
        <SheetHeader>
          <SheetTitle>{route.van.name}</SheetTitle>
          <SheetDescription>
            Labels for the round, and charging points near the van.
          </SheetDescription>
        </SheetHeader>
        <SheetBody>
          <Tabs
            className="stop-drawer"
            value={drawer.tab}
            onValueChange={(value) => isTab(value) && store.setDrawerTab(value)}
          >
            <TabsList>
              <TabsTrigger value="label">Shipping label</TabsTrigger>
              <TabsTrigger value="charging">Charging</TabsTrigger>
            </TabsList>
            <TabsContent value="label" className="stop-drawer__panel">
              <div className="stop-drawer__picker">
                <Label htmlFor={pickerId}>Stop</Label>
                <NativeSelect
                  id={pickerId}
                  value={stop?.id ?? ""}
                  onChange={(event) => store.select(event.target.value)}
                >
                  {route.stops.map((other, index) => (
                    <option key={other.id} value={other.id}>
                      {index + 1}. {other.name}
                    </option>
                  ))}
                </NativeSelect>
              </div>
              {stop ? <ShippingLabel stop={stop} depot={route.van.depot} /> : null}
            </TabsContent>
            <TabsContent value="charging" className="stop-drawer__panel">
              <ChargingMap mapStyle={mapStyle} />
            </TabsContent>
          </Tabs>
        </SheetBody>
      </SheetContent>
    </Sheet>
  );
}
