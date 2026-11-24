import { useState, useSyncExternalStore } from "react";

import type { SidebarMode, SidebarPanelId } from "../store/sidebar-preferences";
import {
  getActivePanelSnapshot,
  getServerActivePanelSnapshot,
  getServerSidebarModeRevisionSnapshot,
  getServerSidebarModeSnapshot,
  getServerSidebarOpenSnapshot,
  getSidebarModeRevisionSnapshot,
  getSidebarModeSnapshot,
  getSidebarOpenSnapshot,
  subscribeToSidebar,
} from "../store/sidebar-store";

export function useSidebarOpen(): boolean {
  return useSyncExternalStore(
    subscribeToSidebar,
    getSidebarOpenSnapshot,
    getServerSidebarOpenSnapshot,
  );
}

// A page that is one of the panels (the calendar) names it as `routePanel`, so
// landing there shows it whatever was stored, until the member picks another.
export function useActivePanel(routePanel?: SidebarPanelId): SidebarPanelId {
  const storedPanel = useSyncExternalStore(
    subscribeToSidebar,
    getActivePanelSnapshot,
    getServerActivePanelSnapshot,
  );
  const revision = useSyncExternalStore(
    subscribeToSidebar,
    getSidebarModeRevisionSnapshot,
    getServerSidebarModeRevisionSnapshot,
  );
  const [entryRevision] = useState(revision);

  if (routePanel && revision === entryRevision) return routePanel;
  return storedPanel;
}

export function useSidebarMode(
  routeMode: SidebarMode | undefined,
  hasAdministration: boolean,
): SidebarMode {
  const storedMode = useSyncExternalStore(
    subscribeToSidebar,
    getSidebarModeSnapshot,
    getServerSidebarModeSnapshot,
  );
  const modeRevision = useSyncExternalStore(
    subscribeToSidebar,
    getSidebarModeRevisionSnapshot,
    getServerSidebarModeRevisionSnapshot,
  );
  const [entryRevision] = useState(modeRevision);

  if (!hasAdministration) return "campus";
  if (routeMode && modeRevision === entryRevision) return routeMode;
  return storedMode ?? "campus";
}
