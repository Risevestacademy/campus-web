import { useSyncExternalStore } from "react";

import type { SidebarMode, SidebarPanelId } from "../store/sidebar-preferences";
import {
  getActivePanelSnapshot,
  getServerActivePanelSnapshot,
  getServerSidebarModeSnapshot,
  getServerSidebarOpenSnapshot,
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
  initialMode: SidebarMode,
  hasAdministration: boolean,
): SidebarMode {
  const storedMode = useSyncExternalStore(
    subscribeToSidebar,
    getSidebarModeSnapshot,
    getServerSidebarModeSnapshot,
  );

  if (!hasAdministration) return "campus";
  if (initialMode === "admin") return "admin";
  return storedMode ?? "campus";
}
