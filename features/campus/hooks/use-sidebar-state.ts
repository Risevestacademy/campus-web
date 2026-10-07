import { useSyncExternalStore } from "react";

import type { SidebarPanelId } from "../store/sidebar-preferences";
import {
  getActivePanelSnapshot,
  getServerActivePanelSnapshot,
  getServerSidebarOpenSnapshot,
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
