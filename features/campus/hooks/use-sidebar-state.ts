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
import { useChatOpen } from "./use-chat-panel";

export function useSidebarOpen(): boolean {
  return useSyncExternalStore(
    subscribeToSidebar,
    getSidebarOpenSnapshot,
    getServerSidebarOpenSnapshot,
  );
}

// What the member sees: the sidebar they left open, unless chat has taken its
// place. Chat is temporary, so the saved choice stays as it was.
export function useSidebarVisible(): boolean {
  const open = useSidebarOpen();
  const chatOpen = useChatOpen();

  return open && !chatOpen;
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
