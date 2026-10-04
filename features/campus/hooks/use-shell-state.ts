import { useSyncExternalStore } from "react";

import type { SidebarPanelId } from "../store/shell-preferences";
import {
  getActivePanelSnapshot,
  getServerActivePanelSnapshot,
  getServerSidebarOpenSnapshot,
  getSidebarOpenSnapshot,
  subscribeToShell,
} from "../store/shell-store";

export function useSidebarOpen(): boolean {
  return useSyncExternalStore(
    subscribeToShell,
    getSidebarOpenSnapshot,
    getServerSidebarOpenSnapshot,
  );
}

export function useActivePanel(): SidebarPanelId {
  return useSyncExternalStore(
    subscribeToShell,
    getActivePanelSnapshot,
    getServerActivePanelSnapshot,
  );
}
