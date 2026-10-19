"use client";

import { createContext, type ReactNode, use, useState, useSyncExternalStore } from "react";
import type { OpResult } from "@/lib/route-ops";
import { seedRoute } from "@/lib/seed/route";
import type { RouteState } from "@/lib/types";

export type DrawerTab = "label" | "charging";

export interface DispatchState {
  /** The round. This is what the agent reads and changes. */
  route: RouteState;
  /** The stop open in the list, on the map and in the drawer. */
  selectedId: string | null;
  drawer: { open: boolean; tab: DrawerTab };
}

const initial = (): DispatchState => ({
  route: seedRoute,
  selectedId: null,
  drawer: { open: false, tab: "label" },
});

/**
 * The one store for the page. It's made per provider, never at module level,
 * so nothing is shared between requests on the server. `getState` is
 * synchronous, so tool calls that run one after another each see the change
 * the one before made.
 */
function createDispatchStore() {
  // What the server renders, and what hydration compares against. Kept as
  // one object so a selector gives the same slice every time it's asked.
  const first = initial();
  let state = first;
  const listeners = new Set<() => void>();
  const set = (next: DispatchState) => {
    state = next;
    for (const listener of listeners) listener();
  };

  return {
    getState: () => state,
    getInitialState: () => first,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    select(id: string | null) {
      set({ ...state, selectedId: id });
    },
    openDrawer(tab: DrawerTab, id?: string) {
      const selectedId =
        id ?? state.selectedId ?? state.route.stops.find((s) => s.status === "next")?.id ?? null;
      set({ ...state, selectedId, drawer: { open: true, tab } });
    },
    setDrawerTab(tab: DrawerTab) {
      set({ ...state, drawer: { ...state.drawer, tab } });
    },
    closeDrawer() {
      set({ ...state, drawer: { ...state.drawer, open: false } });
    },
    /** Runs one of the route operations, and keeps its result when it worked. */
    run<T>(op: (route: RouteState) => OpResult<T>): OpResult<T> {
      const result = op(state.route);
      if (result.ok) {
        const stillThere = result.state.stops.some((stop) => stop.id === state.selectedId);
        set({ ...state, route: result.state, selectedId: stillThere ? state.selectedId : null });
      }
      return result;
    },
    reset() {
      set(initial());
    },
  };
}

export type DispatchStore = ReturnType<typeof createDispatchStore>;

const StoreContext = createContext<DispatchStore | null>(null);

export function DispatchProvider({ children }: { children: ReactNode }) {
  const [store] = useState(createDispatchStore);
  return <StoreContext value={store}>{children}</StoreContext>;
}

export function useDispatchStore(): DispatchStore {
  const store = use(StoreContext);
  if (!store) throw new Error("useDispatchStore needs a DispatchProvider above it.");
  return store;
}

/**
 * A slice of the store. Return a part of the state as it is, not a new
 * object, or the component renders on every change.
 */
export function useDispatch<T>(selector: (state: DispatchState) => T): T {
  const store = useDispatchStore();
  return useSyncExternalStore(
    store.subscribe,
    () => selector(store.getState()),
    () => selector(store.getInitialState()),
  );
}
