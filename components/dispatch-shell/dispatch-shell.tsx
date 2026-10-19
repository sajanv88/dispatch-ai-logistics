"use client";

import {
  BarcodeIcon,
  BatteryChargingIcon,
  CloseIcon,
  MapIcon,
  RefreshIcon,
  SidebarIcon,
  TruckIcon,
} from "@nuvui/icons";
import {
  Badge,
  Button,
  Sheet,
  SheetBody,
  SheetContent,
  SheetHeader,
  SheetTitle,
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMain,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@nuvui/react";
import { type ReactNode, useId, useRef, useState, useSyncExternalStore } from "react";
import { useDispatch, useDispatchStore } from "@/lib/store";
import "./dispatch-shell.scss";

// From this width the assistant sits beside the page. Below it, it opens
// over the page as a sheet. The same width is in dispatch-shell.scss.
const wide = "(width >= 64rem)";

function subscribe(change: () => void) {
  const query = matchMedia(wide);
  query.addEventListener("change", change);
  return () => query.removeEventListener("change", change);
}

// The page is drawn on the server as if it were wide. The stylesheet hides
// the panel on a narrow screen until this has caught up.
function useWide() {
  return useSyncExternalStore(
    subscribe,
    () => matchMedia(wide).matches,
    () => true,
  );
}

interface DispatchShellProps {
  /** The page: the round, as a list and a map. */
  children: ReactNode;
  /** The assistant, beside the page or in a sheet. */
  assistant: ReactNode;
  /** Whether the chat is scripted, because there's no API key. */
  demo: boolean;
  onReset: () => void;
}

export function DispatchShell({ children, assistant, demo, onReset }: DispatchShellProps) {
  const store = useDispatchStore();
  const drawer = useDispatch((state) => state.drawer);
  const isWide = useWide();
  // Two states, so a panel open beside the page on a wide screen isn't a
  // sheet over it when the window narrows.
  const [besideOpen, setBesideOpen] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const panelId = useId();
  const headingId = useId();
  const toggle = useRef<HTMLButtonElement>(null);
  const open = isWide ? besideOpen : sheetOpen;

  return (
    <SidebarProvider className="dispatch-shell" cookieName={null}>
      <Sidebar label="Main">
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip="Dispatch, home">
                <a href="/">
                  <TruckIcon />
                  <span className="dispatch-shell__brand">Dispatch</span>
                </a>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Round</SidebarGroupLabel>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild active={!drawer.open} tooltip="Route">
                  <a href="/" aria-current={drawer.open ? undefined : "page"}>
                    <MapIcon />
                    <span>Route</span>
                  </a>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  active={drawer.open && drawer.tab === "label"}
                  tooltip="Shipping label"
                  onClick={() => store.openDrawer("label")}
                >
                  <BarcodeIcon />
                  <span>Shipping label</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  active={drawer.open && drawer.tab === "charging"}
                  tooltip="Charging"
                  onClick={() => store.openDrawer("charging")}
                >
                  <BatteryChargingIcon />
                  <span>Charging</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>
      <SidebarMain className="dispatch-shell__main">
        <header className="dispatch-shell__bar">
          <SidebarTrigger />
          <h1 className="dispatch-shell__title">Dispatch</h1>
          {demo ? (
            <Badge intent="warning" variant="outline">
              Demo mode
            </Badge>
          ) : null}
          <div className="dispatch-shell__tools">
            <Button intent="ghost" onClick={onReset}>
              <RefreshIcon size={18} />
              Reset demo
            </Button>
            <Button
              ref={toggle}
              intent="ghost"
              aria-expanded={open}
              aria-controls={isWide && besideOpen ? panelId : undefined}
              onClick={() => (isWide ? setBesideOpen((now) => !now) : setSheetOpen(true))}
            >
              <SidebarIcon size={18} />
              Assistant
            </Button>
          </div>
        </header>
        <div className="dispatch-shell__body" data-panel={besideOpen ? "open" : undefined}>
          <div className="dispatch-shell__page">{children}</div>
          {isWide && besideOpen ? (
            <aside id={panelId} className="dispatch-shell__panel" aria-labelledby={headingId}>
              <div className="dispatch-shell__panel-head">
                <h2 id={headingId} className="dispatch-shell__panel-title">
                  Assistant
                </h2>
                <Button
                  intent="ghost"
                  className="dispatch-shell__icon"
                  aria-label="Close the assistant"
                  onClick={() => {
                    setBesideOpen(false);
                    // The button pressed is gone. The one that opens the
                    // panel again takes the focus.
                    toggle.current?.focus();
                  }}
                >
                  <CloseIcon size={18} />
                </Button>
              </div>
              <div className="dispatch-shell__panel-body">{assistant}</div>
            </aside>
          ) : null}
        </div>
      </SidebarMain>
      <Sheet open={!isWide && sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent
          side="end"
          size="lg"
          onCloseAutoFocus={(event) => {
            // A sheet gives the focus back to its own trigger. This one is
            // opened by the bar's button, which isn't one, so it's said here.
            event.preventDefault();
            toggle.current?.focus();
          }}
        >
          <SheetHeader>
            <SheetTitle>Assistant</SheetTitle>
          </SheetHeader>
          <SheetBody className="dispatch-shell__sheet">{assistant}</SheetBody>
        </SheetContent>
      </Sheet>
    </SidebarProvider>
  );
}
