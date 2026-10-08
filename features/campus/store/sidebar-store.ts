"use client";

import {
  DEFAULT_ACTIVE_PANEL,
  DEFAULT_SIDEBAR_OPEN,
  parseStoredSidebarPreferences,
  SIDEBAR_CHANGE_EVENT,
  SIDEBAR_STORAGE_KEY,
  type SidebarMode,
  type SidebarPanelId,
} from "./sidebar-preferences";

function readStoredPreferences() {
  try {
    return parseStoredSidebarPreferences(
      window.localStorage.getItem(SIDEBAR_STORAGE_KEY),
    );
  } catch {
    return parseStoredSidebarPreferences(null);
  }
}

function writeStoredPreferences(
  preferences: ReturnType<typeof readStoredPreferences>,
): void {
  document.documentElement.dataset.sidebarOpen = String(
    preferences.sidebarOpen,
  );

  try {
    window.localStorage.setItem(
      SIDEBAR_STORAGE_KEY,
      JSON.stringify(preferences),
    );
  } catch {}

  window.dispatchEvent(new Event(SIDEBAR_CHANGE_EVENT));
}

export function getActivePanelSnapshot(): SidebarPanelId {
  return readStoredPreferences().activePanel;
}

export function getServerActivePanelSnapshot(): SidebarPanelId {
  return DEFAULT_ACTIVE_PANEL;
}

export function getSidebarModeSnapshot(): SidebarMode | undefined {
  return readStoredPreferences().sidebarMode;
}

export function getServerSidebarModeSnapshot(): undefined {
  return undefined;
}

export function getSidebarOpenSnapshot(): boolean {
  return readStoredPreferences().sidebarOpen;
}

export function getServerSidebarOpenSnapshot(): boolean {
  return DEFAULT_SIDEBAR_OPEN;
}

export function setActivePanel(activePanel: SidebarPanelId): void {
  writeStoredPreferences({
    ...readStoredPreferences(),
    activePanel,
    sidebarMode: "campus",
    sidebarOpen: true,
  });
}

export function setSidebarMode(sidebarMode: SidebarMode): void {
  writeStoredPreferences({
    ...readStoredPreferences(),
    sidebarMode,
    sidebarOpen: true,
  });
}

export function setSidebarOpen(sidebarOpen: boolean): void {
  writeStoredPreferences({ ...readStoredPreferences(), sidebarOpen });
}

export function toggleSidebar(): void {
  setSidebarOpen(!getSidebarOpenSnapshot());
}

export function subscribeToSidebar(onStoreChange: () => void): () => void {
  function handleStorage(event: StorageEvent): void {
    if (event.key !== null && event.key !== SIDEBAR_STORAGE_KEY) return;

    onStoreChange();
  }

  window.addEventListener(SIDEBAR_CHANGE_EVENT, onStoreChange);
  window.addEventListener("storage", handleStorage);

  return () => {
    window.removeEventListener(SIDEBAR_CHANGE_EVENT, onStoreChange);
    window.removeEventListener("storage", handleStorage);
  };
}
