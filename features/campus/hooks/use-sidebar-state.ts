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

export function useActivePanel(): SidebarPanelId {
  return useSyncExternalStore(
    subscribeToSidebar,
    getActivePanelSnapshot,
    getServerActivePanelSnapshot,
  );
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
